-- ============================================================================
-- ASCEND — EXTERNAL DATASETS SEED (curated educational datasets)
-- Metadata ONLY — dataset content is never ingested or used as answer text.
-- Small, well-documented, educationally useful datasets with permissive licenses.
-- ============================================================================

insert into public.external_datasets
  (name, source, url, license, description, subject_domain, difficulty, learning_purpose, provenance, kaggle_slug)
values
  -- Classification Education
  ('Iris', 'Kaggle', 'https://www.kaggle.com/datasets/uciml/iris', 'CC0 (Public Domain)',
   'Classic 3-class flower dataset for clustering/classification. 150 samples, 4 features.',
   'Data Science', 'beginner', 'First classification + EDA + clustering', 'UCI ML Repository (Kaggle)', 'uciml/iris'),

  ('Titanic - Machine Learning from Disaster', 'Kaggle', 'https://www.kaggle.com/c/titanic', 'CC0 (Public Domain)',
   'Beginner classification: predict survival from passenger data. 891 samples, 12 features.',
   'ML', 'beginner', 'First ML project — feature engineering + classification', 'Kaggle', 'titanic'),

  ('Breast Cancer Wisconsin (Diagnostic)', 'Kaggle', 'https://www.kaggle.com/datasets/uciml/breast-cancer-wisconsin-data', 'CC0 (Public Domain)',
   'Binary classification: predict malignant vs benign tumors from cell nucleus measurements. 569 samples, 30 features.',
   'ML', 'beginner', 'Binary classification + medical domain practice', 'UCI ML Repository (Kaggle)', 'uciml/breast-cancer-wisconsin-data'),

  ('Mushroom Classification', 'Kaggle', 'https://www.kaggle.com/datasets/uciml/mushroom-classification', 'CC0 (Public Domain)',
   'Predict edible vs poisonous mushrooms from 22 categorical features. 8,124 samples. Classic classification.',
   'ML', 'beginner', 'Categorical feature encoding + binary classification', 'UCI ML Repository (Kaggle)', 'uciml/mushroom-classification'),

  ('Spam SMS Collection', 'Kaggle', 'https://www.kaggle.com/datasets/uciml/sms-spam-collection-dataset', 'CC BY 4.0',
   'Classify SMS messages as spam or ham. 5,574 messages. Classic text classification.',
   'NLP', 'beginner', 'Text classification practice + NLP preprocessing', 'UCI ML Repository (Kaggle)', 'uciml/sms-spam-collection-dataset'),

  -- Regression Education
  ('California Housing', 'Kaggle', 'https://www.kaggle.com/datasets/camnugent/california-housing-prices', 'CC0 (Public Domain)',
   'Predict median house values in California districts from 1990 census data. 20,640 samples, 8 features.',
   'ML', 'beginner', 'Regression practice + EDA + feature engineering', 'StatLib / Pace & Barry (Kaggle)', 'camnugent/california-housing-prices'),

  ('Wine Quality', 'Kaggle', 'https://www.kaggle.com/datasets/uciml/redwine-quality-cortez-et-al-2009', 'CC BY 4.0',
   'Predict wine quality from physicochemical tests. 1,599 samples, 11 features.',
   'Data Science', 'intermediate', 'Regression practice + EDA', 'UCI ML Repository (Kaggle)', 'uciml/redwine-quality-cortez-et-al-2009'),

  ('Bike Sharing Demand', 'Kaggle', 'https://www.kaggle.com/competitions/bike-sharing-demand', 'CC0 (Public Domain)',
   'Predict bike rental demand from weather, season, and time features. Hourly data, 17,379 records.',
   'ML', 'intermediate', 'Regression + time features + feature engineering', 'Capital Bikeshare / UCI (Kaggle)', 'bike-sharing-demand'),

  -- Data Analysis / EDA
  ('Students Performance in Exams', 'Kaggle', 'https://www.kaggle.com/datasets/spscientist/students-performance-in-exams', 'CC BY 4.0',
   'Predict exam scores from demographics/study habits. 1,000 samples, multiple categorical/numerical features.',
   'Data Science', 'beginner', 'EDA + regression practice + feature analysis', 'UCI (Kaggle)', 'spscientist/students-performance-in-exams'),

  ('Retail Sales Dataset', 'Kaggle', 'https://www.kaggle.com/datasets/mohammadtalib786/retail-sales-dataset', 'CC0 (Public Domain)',
   'Retail transaction data with date, product, category, quantity, price. Good for time-series + EDA.',
   'Data Science', 'beginner', 'Time-series EDA + sales forecasting + cohort analysis', 'Kaggle (synthetic)', 'mohammadtalib786/retail-sales-dataset'),

  -- Computer Vision (metadata only - images not ingested)
  ('MNIST Handwritten Digits', 'Kaggle', 'https://www.kaggle.com/c/digit-recognizer', 'CC0 (Public Domain)',
   'Image classification benchmark of handwritten digits. 70,000 28x28 grayscale images, 10 classes.',
   'Computer Vision', 'beginner', 'Intro to image classification / CV', 'Kaggle', 'digit-recognizer'),

  ('Fashion-MNIST', 'Kaggle', 'https://www.kaggle.com/datasets/zalando-research/fashionmnist', 'MIT License',
   'Clothing-image classification, harder than MNIST. 70,000 28x28 grayscale images, 10 classes.',
   'Computer Vision', 'intermediate', 'CNN practice + transfer learning basics', 'Zalando Research (Kaggle)', 'zalando-research/fashionmnist');

-- ============================================================================
-- ROLLBACK
-- ----------------------------------------------------------------------------
-- delete from public.external_datasets;