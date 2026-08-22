-- ASCEND — GROUNDED EDUCATION ENGINE V1 SEED (part 3b/3): external_datasets (8-13)
insert into public.external_datasets
  (name, source, url, license, description, subject_domain, difficulty, learning_purpose, provenance, kaggle_slug)
values
  ('Heart Disease Dataset', 'Kaggle', 'https://www.kaggle.com/datasets/johnsmith88/heart-disease-dataset', 'CC BY 4.0', 'Classify presence of heart disease from clinical features.', 'ML', 'intermediate', 'Classification + feature importance', 'UCI (Kaggle)', 'johnsmith88/heart-disease-dataset'),
  ('Wine Quality', 'Kaggle', 'https://www.kaggle.com/datasets/uciml/redwine-quality-cortez-et-al-2009', 'CC BY 4.0', 'Predict wine quality from physicochemical tests.', 'Data Science', 'intermediate', 'Regression practice', 'UCI (Kaggle)', 'uciml/redwine-quality-cortez-et-al-2009'),
  ('Boston Housing', 'Kaggle', 'https://www.kaggle.com/datasets/vikrishnan/boston-house-prices', 'CC BY 4.0', 'Predict house prices from neighborhood features.', 'ML', 'intermediate', 'Regression + EDA', 'UCI (Kaggle)', 'vikrishnan/boston-house-prices'),
  ('Drug Review Dataset (UCI)', 'Kaggle', 'https://www.kaggle.com/datasets/jessicali9530/kuc-hackathon-winter-2018', 'CC BY 4.0', 'NLP / regression on patient drug reviews.', 'NLP', 'intermediate', 'Text + tabular ML', 'UCI (Kaggle)', 'jessicali9530/kuc-hackathon-winter-2018'),
  ('Spam SMS Collection', 'Kaggle', 'https://www.kaggle.com/datasets/uciml/sms-spam-collection-dataset', 'CC BY 4.0', 'Classify SMS messages as spam or ham.', 'NLP', 'beginner', 'Text classification practice', 'UCI (Kaggle)', 'uciml/sms-spam-collection-dataset'),
  ('Credit Card Fraud Detection', 'Kaggle', 'https://www.kaggle.com/datasets/mlg-ulb/creditcardfraud', 'CC BY 4.0', 'Imbalanced classification of fraudulent transactions.', 'ML', 'advanced', 'Imbalanced classification practice', 'ULB Machine Learning Group (Kaggle)', 'mlg-ulb/creditcardfraud');
