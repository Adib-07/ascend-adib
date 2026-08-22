-- ASCEND — GROUNDED EDUCATION ENGINE V1 SEED (part 3a/3): external_datasets (1-7)
-- Metadata ONLY — dataset content is never ingested or used as answer text.
insert into public.external_datasets
  (name, source, url, license, description, subject_domain, difficulty, learning_purpose, provenance, kaggle_slug)
values
  ('Titanic - Machine Learning from Disaster', 'Kaggle', 'https://www.kaggle.com/c/titanic', 'CC0 (Public Domain)', 'Beginner classification: predict survival from passenger data.', 'ML', 'beginner', 'First ML project — feature engineering + classification', 'Kaggle', 'titanic'),
  ('MNIST Handwritten Digits', 'Kaggle', 'https://www.kaggle.com/c/digit-recognizer', 'CC0 (Public Domain)', 'Image classification benchmark of handwritten digits.', 'Computer Vision', 'beginner', 'Intro to image classification / CV', 'Kaggle', 'digit-recognizer'),
  ('Fashion-MNIST', 'Kaggle', 'https://www.kaggle.com/datasets/zalando-research/fashionmnist', 'MIT License', 'Clothing-image classification, harder than MNIST.', 'Computer Vision', 'intermediate', 'CNN practice', 'Zalando Research (Kaggle)', 'zalando-research/fashionmnist'),
  ('Iris', 'Kaggle', 'https://www.kaggle.com/datasets/uciml/iris', 'CC0 (Public Domain)', 'Classic 3-class flower dataset for clustering/classification.', 'Data Science', 'beginner', 'First classification + EDA', 'UCI ML (Kaggle)', 'uciml/iris'),
  ('IMDB Movie Reviews (Large Movie Review Dataset)', 'Kaggle', 'https://www.kaggle.com/datasets/lakshmipathi/the-imdb-dataset-of-50k-movie-reviews', 'CC BY-SA 3.0', 'Binary sentiment classification of movie reviews.', 'NLP', 'intermediate', 'Text classification / sentiment', 'ACL (Kaggle)', 'lakshmipathi/the-imdb-dataset-of-50k-movie-reviews'),
  ('COVID-19 Dataset (Johns Hopkins)', 'Kaggle', 'https://www.kaggle.com/datasets/antgoldbloom/covid19-global-dataset', 'CC BY 4.0', 'Global time-series of COVID-19 cases.', 'Data Science', 'intermediate', 'Time-series EDA + visualization', 'Johns Hopkins CSSE (Kaggle)', 'antgoldbloom/covid19-global-dataset'),
  ('Students Performance in Exams', 'Kaggle', 'https://www.kaggle.com/datasets/spscientist/students-performance-in-exams', 'CC BY 4.0', 'Predict exam scores from demographics/study habits.', 'Data Science', 'beginner', 'EDA + regression practice', 'UCI (Kaggle)', 'spscientist/students-performance-in-exams');
