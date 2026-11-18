# Dataset card: NASA PROMISE KC1, as the KC1 project uses it

This card describes the data behind the KC1 defect-prediction model: where it comes from, what each record holds, how the project cleans and splits it, and what to watch for. The figures come from the project's repository and its recorded run of 6 November 2026. The project doesn't store the dataset in its repository; it downloads a public copy when it trains.

| Item | Value |
|---|---|
| Name | NASA PROMISE KC1 software defect dataset |
| Unit | One software module |
| Records | 2,109 as downloaded; 1,212 after removing exact duplicates |
| Predictors | 21 numeric static code metrics |
| Label | `defects`: 1 for a defective module, 0 for a sound one |
| Class balance | 315 defective and 897 sound modules after cleaning (26 % defective) |
| Split | 80 % training, 20 % test, stratified by label, `random_state = 606` |
| Used by | The [KC1 model card](/docs/kc1/model-card) |

## Source and access

`train.py` reads `artifacts/kc1.csv` when that file exists. Otherwise it downloads the CSV from a public GitHub mirror of the PROMISE repository (`ApoorvaKrisna/NASA-promise-dataset-repository`), falls back to OpenML dataset 1067, and saves the copy as `artifacts/kc1.csv`. The `artifacts` folder is excluded from Git, so the repository holds the code that fetches the data, and never the data itself.

If the download fails, download the CSV from the address in `train.py`, save it as `artifacts/kc1.csv`, and run the trainer again.

## What a record holds

Each record describes one module by its static code metrics, grouped here as the Streamlit page groups them:

| Group | Features |
|---|---|
| Complexity | `loc`, `v(g)`, `ev(g)`, `iv(g)`, `branchCount` |
| Halstead metrics | `n`, `v`, `l`, `d`, `i`, `e`, `b`, `t` |
| Code structure | `lOCode`, `lOComment`, `lOBlank`, `locCodeAndComment` |
| Operators and operands | `uniq_Op`, `uniq_Opnd`, `total_Op`, `total_Opnd` |

The complexity group holds McCabe's measures: cyclomatic complexity `v(g)`, essential complexity `ev(g)` and design complexity `iv(g)`. The Halstead group measures the vocabulary and volume of the code, and estimates the effort and time to write it.

## Cleaning

The training script makes three changes and two checks, in this order:

1. It turns the labels `true` and `false` into `1` and `0`.
2. It removes exact duplicate rows: 2,109 rows become 1,212.
3. It splits the records into 969 for training and 243 for testing, stratified by label. The test set holds 63 defective modules.

Before training, it checks that exactly the 21 expected predictors are present, and that each one is numeric with no missing values.

## Things to know before you use it

- **Duplicates.** More than two in five of the downloaded rows (897 of 2,109) repeat another row exactly. Results from a copy that keeps them aren't comparable with this project's results.
- **Imbalance.** About a quarter of the modules are defective. Accuracy alone flatters a model that predicts "sound" for everything, so the project reports precision, recall, F1 and average precision instead.
- **One project.** Every module comes from one NASA software project. A model trained on it has seen no other code base.
- **Static metrics only.** The metrics describe the code as written, not its history, its tests or who changed it.

## About this card

The structure follows *Datasheets for Datasets* (Gebru and others, 2018), shortened to what the project can state from its own code and runs.
