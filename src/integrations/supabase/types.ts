export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      academic_projects: {
        Row: {
          created_at: string;
          deadline: string | null;
          id: string;
          name: string;
          notes: string | null;
          status: string | null;
          tech_stack: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          deadline?: string | null;
          id?: string;
          name: string;
          notes?: string | null;
          status?: string | null;
          tech_stack?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          deadline?: string | null;
          id?: string;
          name?: string;
          notes?: string | null;
          status?: string | null;
          tech_stack?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      clients: {
        Row: {
          contact: string | null;
          created_at: string;
          id: string;
          name: string;
          niche: string | null;
          platform: string | null;
          rating: number | null;
          revenue: number;
          status: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          contact?: string | null;
          created_at?: string;
          id?: string;
          name: string;
          niche?: string | null;
          platform?: string | null;
          rating?: number | null;
          revenue?: number;
          status?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          contact?: string | null;
          created_at?: string;
          id?: string;
          name?: string;
          niche?: string | null;
          platform?: string | null;
          rating?: number | null;
          revenue?: number;
          status?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      coding_problems: {
        Row: {
          created_at: string;
          difficulty: string | null;
          id: string;
          link: string | null;
          notes: string | null;
          platform: string | null;
          solved: boolean;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          difficulty?: string | null;
          id?: string;
          link?: string | null;
          notes?: string | null;
          platform?: string | null;
          solved?: boolean;
          title: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          difficulty?: string | null;
          id?: string;
          link?: string | null;
          notes?: string | null;
          platform?: string | null;
          solved?: boolean;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      daily_intentions: {
        Row: {
          created_at: string;
          day: string;
          id: string;
          intention: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          day: string;
          id?: string;
          intention?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          day?: string;
          id?: string;
          intention?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      exams: {
        Row: {
          created_at: string;
          exam_date: string | null;
          id: string;
          name: string;
          prep_status: string | null;
          subject: string | null;
          syllabus: Json;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          exam_date?: string | null;
          id?: string;
          name: string;
          prep_status?: string | null;
          subject?: string | null;
          syllabus?: Json;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          exam_date?: string | null;
          id?: string;
          name?: string;
          prep_status?: string | null;
          subject?: string | null;
          syllabus?: Json;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      finance_entries: {
        Row: {
          account: string | null;
          amount: number;
          category: string | null;
          created_at: string;
          description: string;
          entry_date: string;
          id: string;
          type: string;
          user_id: string;
        };
        Insert: {
          account?: string | null;
          amount?: number;
          category?: string | null;
          created_at?: string;
          description: string;
          entry_date?: string;
          id?: string;
          type?: string;
          user_id: string;
        };
        Update: {
          account?: string | null;
          amount?: number;
          category?: string | null;
          created_at?: string;
          description?: string;
          entry_date?: string;
          id?: string;
          type?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      flashcard_decks: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          subject: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          subject?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          subject?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      flashcards: {
        Row: {
          back: string;
          created_at: string;
          deck_id: string;
          front: string;
          id: string;
          known: boolean;
          user_id: string;
        };
        Insert: {
          back: string;
          created_at?: string;
          deck_id: string;
          front: string;
          id?: string;
          known?: boolean;
          user_id: string;
        };
        Update: {
          back?: string;
          created_at?: string;
          deck_id?: string;
          front?: string;
          id?: string;
          known?: boolean;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "flashcards_deck_id_fkey";
            columns: ["deck_id"];
            isOneToOne: false;
            referencedRelation: "flashcard_decks";
            referencedColumns: ["id"];
          },
        ];
      };
      goals: {
        Row: {
          created_at: string;
          deadline: string | null;
          done: boolean;
          id: string;
          scope: string;
          text: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          deadline?: string | null;
          done?: boolean;
          id?: string;
          scope: string;
          text: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          deadline?: string | null;
          done?: boolean;
          id?: string;
          scope?: string;
          text?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      habit_logs: {
        Row: {
          day: string;
          done: boolean;
          habit_id: string;
          id: string;
          user_id: string;
        };
        Insert: {
          day: string;
          done?: boolean;
          habit_id: string;
          id?: string;
          user_id: string;
        };
        Update: {
          day?: string;
          done?: boolean;
          habit_id?: string;
          id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "habit_logs_habit_id_fkey";
            columns: ["habit_id"];
            isOneToOne: false;
            referencedRelation: "habits";
            referencedColumns: ["id"];
          },
        ];
      };
      habits: {
        Row: {
          category: string | null;
          created_at: string;
          id: string;
          last_done: string | null;
          name: string;
          streak: number;
          user_id: string;
        };
        Insert: {
          category?: string | null;
          created_at?: string;
          id?: string;
          last_done?: string | null;
          name: string;
          streak?: number;
          user_id: string;
        };
        Update: {
          category?: string | null;
          created_at?: string;
          id?: string;
          last_done?: string | null;
          name?: string;
          streak?: number;
          user_id?: string;
        };
        Relationships: [];
      };
      learn_topics: {
        Row: {
          created_at: string;
          deadline: string | null;
          difficulty: string | null;
          id: string;
          progress: number;
          skill: string;
          source: string | null;
          status: string;
          topic: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          deadline?: string | null;
          difficulty?: string | null;
          id?: string;
          progress?: number;
          skill?: string;
          source?: string | null;
          status?: string;
          topic: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          deadline?: string | null;
          difficulty?: string | null;
          id?: string;
          progress?: number;
          skill?: string;
          source?: string | null;
          status?: string;
          topic?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      notes: {
        Row: {
          content: string | null;
          created_at: string;
          id: string;
          tag: string | null;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          content?: string | null;
          created_at?: string;
          id?: string;
          tag?: string | null;
          title: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          content?: string | null;
          created_at?: string;
          id?: string;
          tag?: string | null;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      outreach: {
        Row: {
          created_at: string;
          expected_value: number | null;
          id: string;
          lead_name: string;
          message_type: string | null;
          niche: string | null;
          notes: string | null;
          outcome: string | null;
          outreach_date: string;
          platform: string | null;
          status: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          expected_value?: number | null;
          id?: string;
          lead_name: string;
          message_type?: string | null;
          niche?: string | null;
          notes?: string | null;
          outcome?: string | null;
          outreach_date?: string;
          platform?: string | null;
          status?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          expected_value?: number | null;
          id?: string;
          lead_name?: string;
          message_type?: string | null;
          niche?: string | null;
          notes?: string | null;
          outcome?: string | null;
          outreach_date?: string;
          platform?: string | null;
          status?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      user_documents: {
        Row: {
          id: string;
          user_id: string;
          filename: string;
          storage_path: string;
          mime_type: string | null;
          size_bytes: number | null;
          document_type: string;
          subject: string | null;
          page_count: number | null;
          status: string;
          error_message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          filename: string;
          storage_path: string;
          mime_type?: string | null;
          size_bytes?: number | null;
          document_type?: string;
          subject?: string | null;
          page_count?: number | null;
          status?: string;
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          filename?: string;
          storage_path?: string;
          mime_type?: string | null;
          size_bytes?: number | null;
          document_type?: string;
          subject?: string | null;
          page_count?: number | null;
          status?: string;
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      quiz_items: {
        Row: {
          answer: string;
          created_at: string;
          id: string;
          question: string;
          topic: string | null;
          user_id: string;
        };
        Insert: {
          answer: string;
          created_at?: string;
          id?: string;
          question: string;
          topic?: string | null;
          user_id: string;
        };
        Update: {
          answer?: string;
          created_at?: string;
          id?: string;
          question?: string;
          topic?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      services: {
        Row: {
          created_at: string;
          delivery_time: string | null;
          id: string;
          name: string;
          premium_price: number | null;
          price_range: string | null;
          standard_price: number | null;
          starter_price: number | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          delivery_time?: string | null;
          id?: string;
          name: string;
          premium_price?: number | null;
          price_range?: string | null;
          standard_price?: number | null;
          starter_price?: number | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          delivery_time?: string | null;
          id?: string;
          name?: string;
          premium_price?: number | null;
          price_range?: string | null;
          standard_price?: number | null;
          starter_price?: number | null;
          user_id?: string;
        };
        Relationships: [];
      };
      tasks: {
        Row: {
          created_at: string;
          done: boolean;
          due_date: string | null;
          due_time: string | null;
          id: string;
          mit_slot: number | null;
          priority: string;
          reminder_time: string | null;
          title: string;
          type: string;
          updated_at: string;
          user_id: string;
          recurrence: string | null;
          recurrence_days: string | null;
          recurrence_end: string | null;
          completed_at: string | null;
        };
        Insert: {
          created_at?: string;
          done?: boolean;
          due_date?: string | null;
          due_time?: string | null;
          id?: string;
          mit_slot?: number | null;
          priority?: string;
          reminder_time?: string | null;
          title: string;
          type?: string;
          updated_at?: string;
          user_id: string;
          recurrence?: string | null;
          recurrence_days?: string | null;
          recurrence_end?: string | null;
          completed_at?: string | null;
        };
        Update: {
          created_at?: string;
          done?: boolean;
          due_date?: string | null;
          due_time?: string | null;
          id?: string;
          mit_slot?: number | null;
          priority?: string;
          reminder_time?: string | null;
          title?: string;
          type?: string;
          updated_at?: string;
          user_id?: string;
          recurrence?: string | null;
          recurrence_days?: string | null;
          recurrence_end?: string | null;
          completed_at?: string | null;
        };
        Relationships: [];
      };
      work_projects: {
        Row: {
          client_id: string | null;
          created_at: string;
          deadline: string | null;
          id: string;
          name: string;
          progress: number;
          revenue: number;
          status: string | null;
          type: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          client_id?: string | null;
          created_at?: string;
          deadline?: string | null;
          id?: string;
          name: string;
          progress?: number;
          revenue?: number;
          status?: string | null;
          type?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          client_id?: string | null;
          created_at?: string;
          deadline?: string | null;
          id?: string;
          name?: string;
          progress?: number;
          revenue?: number;
          status?: string | null;
          type?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "work_projects_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      external_datasets: {
        Row: {
          id: string;
          name: string;
          source: string;
          url: string;
          license: string;
          description: string | null;
          subject_domain: string;
          difficulty: string;
          learning_purpose: string | null;
          provenance: string | null;
          kaggle_slug: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          source: string;
          url: string;
          license: string;
          description?: string | null;
          subject_domain: string;
          difficulty?: string;
          learning_purpose?: string | null;
          provenance?: string | null;
          kaggle_slug?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          source?: string;
          url?: string;
          license?: string;
          description?: string | null;
          subject_domain?: string;
          difficulty?: string;
          learning_purpose?: string | null;
          provenance?: string | null;
          kaggle_slug?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      dataset_files: {
        Row: {
          id: string;
          external_dataset_id: string | null;
          user_id: string | null;
          filename: string;
          storage_path: string;
          mime_type: string | null;
          size_bytes: number | null;
          file_format: string | null;
          row_count: number | null;
          column_count: number | null;
          columns_json: Json | null;
          profile_json: Json | null;
          ingestion_status: string;
          error_message: string | null;
          checksum: string | null;
          ingested_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          external_dataset_id?: string | null;
          user_id?: string | null;
          filename: string;
          storage_path: string;
          mime_type?: string | null;
          size_bytes?: number | null;
          file_format?: string | null;
          row_count?: number | null;
          column_count?: number | null;
          columns_json?: Json | null;
          profile_json?: Json | null;
          ingestion_status?: string;
          error_message?: string | null;
          checksum?: string | null;
          ingested_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          external_dataset_id?: string | null;
          user_id?: string | null;
          filename?: string;
          storage_path?: string;
          mime_type?: string | null;
          size_bytes?: number | null;
          file_format?: string | null;
          row_count?: number | null;
          column_count?: number | null;
          columns_json?: Json | null;
          profile_json?: Json | null;
          ingestion_status?: string;
          error_message?: string | null;
          checksum?: string | null;
          ingested_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "dataset_files_external_dataset_id_fkey";
            columns: ["external_dataset_id"];
            isOneToOne: false;
            referencedRelation: "external_datasets";
            referencedColumns: ["id"];
          },
        ];
      };
      document_chunks: {
        Row: {
          id: string;
          user_id: string;
          document_id: string;
          chunk_index: number;
          page_number: number | null;
          heading: string | null;
          content_text: string;
          token_count: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          document_id: string;
          chunk_index: number;
          page_number?: number | null;
          heading?: string | null;
          content_text: string;
          token_count?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          document_id?: string;
          chunk_index?: number;
          page_number?: number | null;
          heading?: string | null;
          content_text?: string;
          token_count?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "document_chunks_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "auth.users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "document_chunks_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "user_documents";
            referencedColumns: ["id"];
          },
        ];
      };
      events: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          description: string | null;
          start_at: string;
          end_at: string;
          timezone: string;
          all_day: boolean;
          location: string | null;
          task_id: string | null;
          project_id: string | null;
          recurrence: string | null;
          recurrence_days: string | null;
          recurrence_end: string | null;
          color: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          description?: string | null;
          start_at: string;
          end_at: string;
          timezone?: string;
          all_day?: boolean;
          location?: string | null;
          task_id?: string | null;
          project_id?: string | null;
          recurrence?: string | null;
          recurrence_days?: string | null;
          recurrence_end?: string | null;
          color?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          description?: string | null;
          start_at?: string;
          end_at?: string;
          timezone?: string;
          all_day?: boolean;
          location?: string | null;
          task_id?: string | null;
          project_id?: string | null;
          recurrence?: string | null;
          recurrence_days?: string | null;
          recurrence_end?: string | null;
          color?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "events_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "events_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "auth.users";
            referencedColumns: ["id"];
          },
        ];
      };
      reminders: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          message: string | null;
          trigger_at: string;
          timezone: string;
          status: string;
          related_type: string | null;
          related_id: string | null;
          delivery_channel: string;
          sent_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          message?: string | null;
          trigger_at: string;
          timezone?: string;
          status?: string;
          related_type?: string | null;
          related_id?: string | null;
          delivery_channel?: string;
          sent_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          message?: string | null;
          trigger_at?: string;
          timezone?: string;
          status?: string;
          related_type?: string | null;
          related_id?: string | null;
          delivery_channel?: string;
          sent_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reminders_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "auth.users";
            referencedColumns: ["id"];
          },
        ];
      };
      automation_rules: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          enabled: boolean;
          trigger_type: string;
          trigger_config: Json;
          condition_config: Json;
          action_type: string;
          action_config: Json;
          last_run_at: string | null;
          run_count: number;
          last_error: string | null;
          created_at: string;
          updated_at: string;
          last_triggered_at: string | null;
          timezone: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          description?: string | null;
          enabled?: boolean;
          trigger_type: string;
          trigger_config?: Json;
          condition_config?: Json;
          action_type: string;
          action_config?: Json;
          last_run_at?: string | null;
          run_count?: number;
          last_error?: string | null;
          created_at?: string;
          updated_at?: string;
          last_triggered_at?: string | null;
          timezone?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          description?: string | null;
          enabled?: boolean;
          trigger_type?: string;
          trigger_config?: Json;
          condition_config?: Json;
          action_type?: string;
          action_config?: Json;
          last_run_at?: string | null;
          run_count?: number;
          last_error?: string | null;
          created_at?: string;
          updated_at?: string;
          last_triggered_at?: string | null;
          timezone?: string;
        };
        Relationships: [
          {
            foreignKeyName: "automation_rules_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "auth.users";
            referencedColumns: ["id"];
          },
        ];
      };
      automation_logs: {
        Row: {
          id: string;
          user_id: string;
          rule_id: string;
          status: string;
          trigger_data: Json | null;
          condition_result: boolean | null;
          action_result: Json | null;
          error_message: string | null;
          executed_at: string;
          execution_id: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          rule_id: string;
          status: string;
          trigger_data?: Json | null;
          condition_result?: boolean | null;
          action_result?: Json | null;
          error_message?: string | null;
          executed_at?: string;
          execution_id?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          rule_id?: string;
          status?: string;
          trigger_data?: Json | null;
          condition_result?: boolean | null;
          action_result?: Json | null;
          error_message?: string | null;
          executed_at?: string;
          execution_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "automation_logs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "auth.users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "automation_logs_rule_id_fkey";
            columns: ["rule_id"];
            isOneToOne: false;
            referencedRelation: "automation_rules";
            referencedColumns: ["id"];
          },
        ];
      };
      daily_briefing: {
        Row: {
          id: string;
          user_id: string;
          briefing_date: string;
          overdue_tasks: Json;
          today_tasks: Json;
          today_events: Json;
          today_habits: Json;
          upcoming_deadlines: Json;
          active_projects: Json;
          daily_intention: string | null;
          priority_summary: string | null;
          generated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          briefing_date: string;
          overdue_tasks?: Json;
          today_tasks?: Json;
          today_events?: Json;
          today_habits?: Json;
          upcoming_deadlines?: Json;
          active_projects?: Json;
          daily_intention?: string | null;
          priority_summary?: string | null;
          generated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          briefing_date?: string;
          overdue_tasks?: Json;
          today_tasks?: Json;
          today_events?: Json;
          today_habits?: Json;
          upcoming_deadlines?: Json;
          active_projects?: Json;
          daily_intention?: string | null;
          priority_summary?: string | null;
          generated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "daily_briefing_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "auth.users";
            referencedColumns: ["id"];
          },
        ];
      };
      weekly_review: {
        Row: {
          id: string;
          user_id: string;
          week_start: string;
          week_end: string;
          completed_tasks: Json;
          incomplete_tasks: Json;
          habit_completion: Json;
          streak_changes: Json;
          project_progress: Json;
          goal_progress: Json;
          important_notes: Json;
          upcoming_deadlines: Json;
          summary_text: string | null;
          generated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          week_start: string;
          week_end: string;
          completed_tasks?: Json;
          incomplete_tasks?: Json;
          habit_completion?: Json;
          streak_changes?: Json;
          project_progress?: Json;
          goal_progress?: Json;
          important_notes?: Json;
          upcoming_deadlines?: Json;
          summary_text?: string | null;
          generated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          week_start?: string;
          week_end?: string;
          completed_tasks?: Json;
          incomplete_tasks?: Json;
          habit_completion?: Json;
          streak_changes?: Json;
          project_progress?: Json;
          goal_progress?: Json;
          important_notes?: Json;
          upcoming_deadlines?: Json;
          summary_text?: string | null;
          generated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "weekly_review_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "auth.users";
            referencedColumns: ["id"];
          },
        ];
      };
      event_emission_logs: {
        Row: {
          id: string;
          user_id: string;
          event_type: string;
          entity_id: string;
          event_timestamp: string;
          payload: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          event_type: string;
          entity_id: string;
          event_timestamp: string;
          payload?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          event_type?: string;
          entity_id?: string;
          event_timestamp?: string;
          payload?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "event_emission_logs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "auth.users";
            referencedColumns: ["id"];
          },
        ];
      };
      event_processing_logs: {
        Row: {
          id: string;
          user_id: string;
          event_idempotency_key: string;
          event_type: string;
          entity_id: string;
          status: string;
          matched_rules: number;
          executed_automations: number;
          error_message: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          event_idempotency_key: string;
          event_type: string;
          entity_id: string;
          status?: string;
          matched_rules?: number;
          executed_automations?: number;
          error_message?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          event_idempotency_key?: string;
          event_type?: string;
          entity_id?: string;
          status?: string;
          matched_rules?: number;
          executed_automations?: number;
          error_message?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "event_processing_logs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "auth.users";
            referencedColumns: ["id"];
          },
        ];
      };
      student_profile: {
        Row: {
          id: string;
          user_id: string;
          semester: string | null;
          academic_goals: string | null;
          study_availability: Json | null;
          preferred_session_length: number;
          exam_alert_days_before: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          semester?: string | null;
          academic_goals?: string | null;
          study_availability?: Json | null;
          preferred_session_length?: number;
          exam_alert_days_before?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          semester?: string | null;
          academic_goals?: string | null;
          study_availability?: Json | null;
          preferred_session_length?: number;
          exam_alert_days_before?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "student_profile_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "auth.users";
            referencedColumns: ["id"];
          },
        ];
      };
      tutor_sessions: {
        Row: {
          id: string;
          user_id: string;
          mode: string;
          subject: string | null;
          language: string | null;
          context_snapshot: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          mode: string;
          subject?: string | null;
          language?: string | null;
          context_snapshot?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          mode?: string;
          subject?: string | null;
          language?: string | null;
          context_snapshot?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tutor_sessions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "auth.users";
            referencedColumns: ["id"];
          },
        ];
      };
      tutor_messages: {
        Row: {
          id: string;
          session_id: string;
          user_id: string;
          role: string;
          content: string;
          sources: Json | null;
          datasets: Json | null;
          grounded: boolean | null;
          syllabus_match: boolean | null;
          mode: string | null;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          user_id: string;
          role: string;
          content: string;
          sources?: Json | null;
          datasets?: Json | null;
          grounded?: boolean | null;
          syllabus_match?: boolean | null;
          mode?: string | null;
          metadata?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          user_id?: string;
          role?: string;
          content?: string;
          sources?: Json | null;
          datasets?: Json | null;
          grounded?: boolean | null;
          syllabus_match?: boolean | null;
          mode?: string | null;
          metadata?: Json | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tutor_messages_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "tutor_sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tutor_messages_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "auth.users";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
