# Model card: KC1 defect prediction

This model card describes the classifier that the KC1 project serves: what it predicts, what it was trained and tested on, how well it does, and where it shouldn't be used. Every figure comes from the project's repository and its recorded runs of 6 November 2026. The model was built by ESAIP MSc Group 6 as an academic team project; I wrote its container setup, its README and this card.

| Item | Value |
|---|---|
| Task | Binary classification: is a software module likely to contain a defect? |
| Model | Balanced logistic regression: `StandardScaler`, then `LogisticRegression(max_iter=5000, class_weight="balanced")` |
| Inputs | 21 numeric static code metrics of one module |
| Output | The probability that the module is defective, and the class at a threshold of 0.50 |
| Training data | NASA PROMISE KC1, 969 modules after cleaning and splitting |
| Test result | F1 0.500, recall 0.571, precision 0.444 on 243 held-out modules |
| Served by | A FastAPI service (`GET /health`, `POST /predict`) and a Streamlit page, in the Docker image `group6-kc1:latest` |
| Source | [group6-kc1-defect-prediction](https://github.com/domail2karandeshmukh-cyber/group6-kc1-defect-prediction), commit `9b696fc` |

## Intended use

The model and its service are a classroom demonstration of a reproducible machine-learning workflow: training, experiment tracking, serving and containers. It suits:

- Students and reviewers who want to follow a model from training data to a running API.
- Developers who want an example of a scikit-learn pipeline served with FastAPI and tracked in MLflow.

It isn't made for these uses:

- Deciding on its own whether a module ships. At the selected threshold, 45 of the 81 modules it flags are false alarms.
- Code bases unlike KC1. The model has seen one NASA project's modules and no others.
- Judging the people who wrote the code. The metrics describe modules, not developers.

## Model details

`train.py` fits four supervised candidates on the same training split and keeps one:

| Candidate | Algorithm | Class weighting |
|---|---|---|
| Logistic default | Logistic regression on standardized metrics | None |
| Logistic balanced | Logistic regression on standardized metrics | Balanced |
| Random Forest default | Random forest of 300 trees | None |
| Random Forest balanced | Random forest of 300 trees | Balanced |

The logistic regressions run up to 5,000 iterations (`max_iter=5000`). Balanced weighting (`class_weight="balanced"`) gives the rarer defective modules more weight in training.

The selection rule ranks the candidates by recall on the test set, then by average precision. Recall comes first because a missed defective module usually costs more than an extra review. For the chosen candidate, the rule then compares the thresholds 0.30, 0.50 and 0.70 and keeps the best F1.

The API refuses a request unless it holds exactly the 21 fields, each a finite number. It calls the saved pipeline in the training column order and returns the class, the probability and the threshold.

## Training and evaluation data

The data is the NASA PROMISE KC1 dataset: 2,109 module records with 21 static code metrics and a defect label. Removing exact duplicate rows leaves 1,212 records, 315 of them defective (26 %). A stratified split with `random_state = 606` gives 969 training modules and 243 test modules, 63 of them defective.

The [dataset card](/docs/kc1/dataset-card) describes the source, the cleaning and the features.

## Results

Every candidate on the 243 test modules, at a threshold of 0.50:

| Model | Precision | Recall | F1 | Average precision | TP | FP | FN | TN |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| **Logistic balanced** (selected) | 0.444 | **0.571** | **0.500** | 0.495 | 36 | 45 | 27 | 135 |
| Random Forest balanced | 0.459 | 0.444 | 0.452 | 0.410 | 28 | 33 | 35 | 147 |
| Random Forest default | 0.525 | 0.333 | 0.408 | 0.449 | 21 | 19 | 42 | 161 |
| Logistic default | 0.522 | 0.190 | 0.279 | 0.494 | 12 | 11 | 51 | 169 |

The selected model finds 36 of the 63 defective modules, at the cost of 45 false alarms.

The threshold decides the trade-off between missed defects and false alarms:

| Threshold | Precision | Recall | F1 | False positives | False negatives |
|---:|---:|---:|---:|---:|---:|
| 0.30 | 0.268 | 0.937 | 0.417 | 161 | 4 |
| **0.50** (selected) | 0.444 | 0.571 | **0.500** | 45 | 27 |
| 0.70 | 0.538 | 0.222 | 0.315 | 12 | 49 |

A team that would rather review more modules than miss a defect could choose 0.30: it misses 4 defective modules instead of 27, and flags 161 sound ones.

### An unsupervised comparison

Gaussian mixture models with 2, 3 and 4 components were fitted to the standardized metrics without the defect labels. Four components gave the lowest BIC (2,404.5). On the test modules, the defect rate inside the four components ranges from 10.3 % to 43.9 %, against 26 % overall. The metrics separate riskier modules from safer ones even without labels.

## Limitations

- The model and its threshold were chosen on the test set, following the course's original notebook. The test scores are therefore optimistic. A production workflow would choose them on a validation split or by cross-validation, and keep the test set for the final measure.
- The data is imbalanced: 26 % of the modules are defective. Precision stays below 0.55 for every candidate.
- `requirements.txt` gives version ranges. A rebuild with newer libraries may give slightly different numbers.
- The API has no authentication and listens on `127.0.0.1` only. It's a local demonstration, not an internet-facing service.
- Docker Scout reports known vulnerabilities in the base image and in some installed packages. They should be updated and the image scanned again before any production use.
- The BIC was still falling at four components, the largest number tried.

## Reproduce the results

The repository's README gives the full procedure. In short, from the project folder:

1. Build the image with `docker compose build`.
2. Train and export the model with `docker compose --profile train run --rm trainer`.
3. Start the API, the Streamlit page and MLflow with `docker compose up -d`.

Training records ten runs in the MLflow experiment `Group6_KC1_Defect_Prediction`: four classifiers, three thresholds and three mixture models. The file `artifacts/deployment_config.json` names the MLflow run of the model that the API serves.

A second run on 6 November 2026, from a clean copy on Linux with Python 3.11, scikit-learn 1.9.1 and MLflow 3.18.0, reproduced the team's results exactly: 1,212 rows, the same selected model, F1 0.500, four mixture components, and a probability of 72.3 % for the sample module.

## About this card

The structure follows *Model Cards for Model Reporting* (Mitchell and others, 2019), shortened to the sections a classroom model can fill honestly. The figures are copied from the project's recorded results, not measured again for this page.
