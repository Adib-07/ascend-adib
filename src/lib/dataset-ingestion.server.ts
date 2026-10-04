import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { mapAuthError } from "@/lib/auth-errors";

const KAGGLE_USERNAME = process.env.KAGGLE_USERNAME;
const KAGGLE_KEY = process.env.KAGGLE_KEY;

export const ALLOWED_ARCHIVE_TYPES = [
  "application/zip",
  "application/x-zip-compressed",
  "application/gzip",
  "application/x-gzip",
];
export const ALLOWED_DATA_TYPES = [
  "text/csv",
  "application/json",
  "application/parquet",
  "text/plain",
];
export const MAX_DOWNLOAD_SIZE = 200 * 1024 * 1024; // 200MB

interface DatasetProfile {
  rowCount: number;
  columnCount: number;
  columns: Array<{
    name: string;
    type: string;
    sampleValues: (string | number)[];
    missingCount: number;
  }>;
  stats: Record<
    string,
    { min?: number; max?: number; mean?: number; std?: number; unique?: number }
  >;
  targetColumnSuggestions: string[];
}

export function validateKaggleSlug(slug: string): boolean {
  return /^[a-z0-9-]+\/[a-z0-9-_]+$/.test(slug);
}

export function sanitizePathSegment(segment: string): string {
  return segment.replace(/[^a-zA-Z0-9-_]/g, "_");
}

async function downloadFromKaggle(
  slug: string,
): Promise<{ buffer: ArrayBuffer; filename: string; mimeType: string }> {
  if (!KAGGLE_USERNAME || !KAGGLE_KEY) {
    throw new Error("Kaggle credentials not configured on server");
  }

  const auth = Buffer.from(`${KAGGLE_USERNAME}:${KAGGLE_KEY}`).toString("base64");
  const url = `https://www.kaggle.com/api/v1/datasets/download/${slug}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: "application/zip",
    },
  });

  if (!response.ok) {
    if (response.status === 401) throw new Error("Invalid Kaggle credentials");
    if (response.status === 404) throw new Error("Dataset not found on Kaggle");
    throw new Error(`Kaggle download failed: ${response.status}`);
  }

  const contentLength = response.headers.get("content-length");
  if (contentLength && parseInt(contentLength) > MAX_DOWNLOAD_SIZE) {
    throw new Error("Dataset exceeds maximum download size");
  }

  const buffer = await response.arrayBuffer();
  const contentDisposition = response.headers.get("content-disposition");
  let filename = `${slug.replace("/", "_")}.zip`;
  if (contentDisposition) {
    const match = contentDisposition.match(/filename="?([^"]+)"?/);
    if (match) filename = match[1];
  }

  const mimeType = response.headers.get("content-type") || "application/zip";
  return { buffer, filename, mimeType };
}

async function extractZip(buffer: ArrayBuffer): Promise<Array<{ name: string; data: Uint8Array }>> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buffer);
  const files: Array<{ name: string; data: Uint8Array }> = [];
  for (const [name, file] of Object.entries(zip.files)) {
    if (!file.dir) {
      const data = await file.async("uint8array");
      files.push({ name, data });
    }
  }
  return files;
}

export function detectFileType(filename: string, data: Uint8Array): string {
  const ext = filename.toLowerCase().split(".").pop();
  if (ext === "csv") return "csv";
  if (ext === "json") return "json";
  if (ext === "parquet") return "parquet";
  if (ext === "npz") return "npz";
  if (ext === "txt" || ext === "tsv") return "csv";
  return "unknown";
}

export async function profileCSV(data: Uint8Array): Promise<DatasetProfile> {
  const text = new TextDecoder("utf-8").decode(data);
  const lines = text
    .trim()
    .split("\n")
    .filter((l) => l.length > 0);
  if (lines.length < 2) throw new Error("CSV has no data rows");

  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  const rows = lines.slice(1).map((l) => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < l.length; i++) {
      const char = l[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  });

  const columnCount = headers.length;
  const rowCount = rows.length;
  const columns = headers.map((name, idx) => {
    const values = rows.map((r) => r[idx] ?? "").filter((v) => v !== "");
    const missingCount = rowCount - values.length;
    const sampleValues = values.slice(0, 5).map((v) => {
      const num = parseFloat(v);
      return isNaN(num) ? v.replace(/^"|"$/g, "") : num;
    });
    const numericValues = values.map((v) => parseFloat(v)).filter((v) => !isNaN(v));
    let type = "string";
    if (numericValues.length > values.length * 0.8) type = "numeric";
    else if (new Set(values).size <= 20 && values.length > 0) type = "categorical";

    let stats: any = { unique: new Set(values).size };
    if (type === "numeric" && numericValues.length > 0) {
      const sorted = [...numericValues].sort((a, b) => a - b);
      stats = {
        min: sorted[0],
        max: sorted[sorted.length - 1],
        mean: numericValues.reduce((a, b) => a + b, 0) / numericValues.length,
        std: Math.sqrt(
          numericValues.reduce((a, b) => a + Math.pow(b - stats.mean, 2), 0) / numericValues.length,
        ),
        unique: stats.unique,
      };
    }

    return { name, type, sampleValues, missingCount, stats };
  });

  const targetColumnSuggestions = columns
    .filter((c) => c.type === "categorical" && c.stats.unique >= 2 && c.stats.unique <= 10)
    .map((c) => c.name);

  return { rowCount, columnCount, columns, stats: {}, targetColumnSuggestions };
}

export async function profileJSON(data: Uint8Array): Promise<DatasetProfile> {
  const text = new TextDecoder("utf-8").decode(data);
  const json = JSON.parse(text);
  let rows: any[] = [];
  if (Array.isArray(json)) rows = json;
  else if (json.data && Array.isArray(json.data)) rows = json.data;
  else throw new Error("Unrecognized JSON structure");

  if (rows.length === 0) throw new Error("JSON has no data rows");
  const sample = rows[0];
  const headers = Object.keys(sample);
  const columns = headers.map((name) => {
    const values = rows.map((r) => r[name]).filter((v) => v !== null && v !== undefined);
    const missingCount = rows.length - values.length;
    const sampleValues = values.slice(0, 5);
    const numericValues = values.map((v) => parseFloat(String(v))).filter((v) => !isNaN(v));
    let type = "string";
    if (numericValues.length > values.length * 0.8) type = "numeric";
    else if (new Set(values).size <= 20) type = "categorical";
    return { name, type, sampleValues, missingCount, stats: { unique: new Set(values).size } };
  });
  return {
    rowCount: rows.length,
    columnCount: headers.length,
    columns,
    stats: {},
    targetColumnSuggestions: [],
  };
}

export async function profileDataset(filename: string, data: Uint8Array): Promise<DatasetProfile> {
  const fileType = detectFileType(filename, data);
  if (fileType === "csv") return profileCSV(data);
  if (fileType === "json") return profileJSON(data);
  throw new Error(`Unsupported file format: ${fileType}`);
}

async function computeChecksum(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ============================================================================
// Server Functions
// ============================================================================

export const ingestDataset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      externalDatasetId: z.string().uuid(),
      forceReingest: z.boolean().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Get external dataset metadata
    const { data: extDataset, error: extError } = await supabase
      .from("external_datasets")
      .select("*")
      .eq("id", data.externalDatasetId)
      .maybeSingle();

    if (extError || !extDataset) throw new Error("External dataset not found");
    if (!extDataset.kaggle_slug) throw new Error("Dataset has no Kaggle slug");

    if (!validateKaggleSlug(extDataset.kaggle_slug)) {
      throw new Error("Invalid Kaggle slug format");
    }

    // Check if already ingested
    const { data: existing } = await supabase
      .from("dataset_files")
      .select("*")
      .eq("external_dataset_id", data.externalDatasetId)
      .is("user_id", null)
      .maybeSingle();

    if (existing && !data.forceReingest) {
      return { datasetFile: existing, message: "Already ingested" };
    }

    // Create or update dataset_files record
    let datasetFileId: string;
    if (existing) {
      datasetFileId = existing.id;
      await supabase
        .from("dataset_files")
        .update({
          ingestion_status: "downloading",
          error_message: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", datasetFileId);
    } else {
      const { data: newFile, error } = await supabase
        .from("dataset_files")
        .insert({
          external_dataset_id: data.externalDatasetId,
          user_id: null,
          filename: "",
          storage_path: "",
          mime_type: null,
          size_bytes: 0,
          ingestion_status: "downloading",
        })
        .select()
        .single();
      if (error) throw error;
      datasetFileId = newFile.id;
    }

    try {
      // Download
      await supabase
        .from("dataset_files")
        .update({ ingestion_status: "downloading" })
        .eq("id", datasetFileId);

      const { buffer, filename, mimeType } = await downloadFromKaggle(extDataset.kaggle_slug);

      // Validate archive type
      if (!ALLOWED_ARCHIVE_TYPES.includes(mimeType) && !filename.endsWith(".zip")) {
        throw new Error(`Unsupported archive type: ${mimeType}`);
      }

      // Update status
      await supabase
        .from("dataset_files")
        .update({ ingestion_status: "extracting" })
        .eq("id", datasetFileId);

      // Extract
      const extracted = await extractZip(buffer);
      if (extracted.length === 0) throw new Error("Archive is empty");

      // Find main data file (prefer CSV, then JSON, then largest)
      let mainFile = extracted.find((f) => f.name.toLowerCase().endsWith(".csv"));
      if (!mainFile) mainFile = extracted.find((f) => f.name.toLowerCase().endsWith(".json"));
      if (!mainFile) mainFile = extracted.reduce((a, b) => (a.data.length > b.data.length ? a : b));

      // Profile
      await supabase
        .from("dataset_files")
        .update({ ingestion_status: "processing" })
        .eq("id", datasetFileId);

      const profile = await profileDataset(mainFile.name, mainFile.data);

      // Upload to storage
      const safeFilename = sanitizePathSegment(mainFile.name);
      const storagePath = `global/${data.externalDatasetId}/${safeFilename}`;
      const { error: uploadError } = await supabase.storage
        .from("dataset-files")
        .upload(storagePath, mainFile.data, {
          contentType: mainFile.name.endsWith(".csv")
            ? "text/csv"
            : mainFile.name.endsWith(".json")
              ? "application/json"
              : "application/octet-stream",
          upsert: true,
        });
      if (uploadError) throw uploadError;

      // Compute checksum
      const checksum = await computeChecksum(buffer);

      // Update record with all metadata
      await supabase
        .from("dataset_files")
        .update({
          filename: mainFile.name,
          storage_path: storagePath,
          mime_type: mainFile.name.endsWith(".csv") ? "text/csv" : "application/json",
          size_bytes: mainFile.data.length,
          file_format: mainFile.name.endsWith(".csv") ? "csv" : "json",
          row_count: profile.rowCount,
          column_count: profile.columnCount,
          columns_json: profile.columns,
          profile_json: {
            stats: profile.stats,
            targetColumnSuggestions: profile.targetColumnSuggestions,
          },
          ingestion_status: "ready",
          error_message: null,
          checksum,
          ingested_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", datasetFileId);

      const { data: result } = await supabase
        .from("dataset_files")
        .select("*")
        .eq("id", datasetFileId)
        .single();

      return { datasetFile: result, message: "Ingestion complete" };
    } catch (err: any) {
      await supabase
        .from("dataset_files")
        .update({
          ingestion_status: "failed",
          error_message: err.message,
          updated_at: new Date().toISOString(),
        })
        .eq("id", datasetFileId);
      throw new Error(`Ingestion failed: ${err.message}`);
    }
  });

export const getDatasetFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ datasetFileId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: file, error } = await supabase
      .from("dataset_files")
      .select("*")
      .eq("id", data.datasetFileId)
      .single();
    if (error || !file) throw new Error("Dataset file not found");
    // Global files (user_id = null) are accessible to all; user-owned files only to owner
    if (file.user_id !== null && file.user_id !== userId) {
      throw new Error("Dataset file not found");
    }
    return file;
  });

export const listDatasetFiles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ externalDatasetId: z.string().uuid().optional() }))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    let query = supabase
      .from("dataset_files")
      .select("*")
      .or(`user_id.is.null,user_id.eq.${userId}`)
      .order("created_at", { ascending: false });
    if (data.externalDatasetId) query = query.eq("external_dataset_id", data.externalDatasetId);
    const { data: files, error } = await query;
    if (error) throw error;
    return files ?? [];
  });

export const deleteDatasetFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ datasetFileId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: file } = await supabase
      .from("dataset_files")
      .select("*")
      .eq("id", data.datasetFileId)
      .single();
    if (!file) throw new Error("Dataset file not found");

    // Only allow deletion of user-owned files (global files managed by admin)
    if (file.user_id !== null) {
      const { data: user } = await supabase.auth.getUser();
      if (file.user_id !== user.user?.id) throw new Error("Not authorized to delete this file");
    }

    // Delete from storage
    if (file.storage_path) {
      await supabase.storage.from("dataset-files").remove([file.storage_path]);
    }

    // Delete record
    const { error } = await supabase.from("dataset_files").delete().eq("id", data.datasetFileId);
    if (error) throw error;

    return { success: true };
  });

export const getDatasetSample = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      datasetFileId: z.string().uuid(),
      limit: z.number().int().min(1).max(100).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: file } = await supabase
      .from("dataset_files")
      .select("*")
      .eq("id", data.datasetFileId)
      .single();
    if (!file || !file.storage_path) throw new Error("Dataset file not found or not ready");
    // Global files (user_id = null) are accessible to all; user-owned files only to owner
    if (file.user_id !== null && file.user_id !== userId) {
      throw new Error("Dataset file not found or not ready");
    }

    const { data: fileData, error } = await supabase.storage
      .from("dataset-files")
      .download(file.storage_path);
    if (error || !fileData) throw new Error("Failed to download dataset file");

    const buffer = await fileData.arrayBuffer();
    const profile = await profileDataset(file.filename, new Uint8Array(buffer));

    return {
      profile,
      sampleRows: profile.columns.map((c) => c.sampleValues),
      columns: profile.columns,
    };
  });
