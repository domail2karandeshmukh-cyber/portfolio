# Capture and annotation

How the screenshots of real products are made, so that each one can be made again.

- `mlflow_capture.py` opens MLflow 3.18.0 on the KC1 project's tracking database, takes each screen of the guide
  "Compare the KC1 model candidates in MLflow" at 1,280 x 800, and records the box of every control that a step names.
- `annotate.py` draws the house marks on those boxes with the site's own Screenshot Studio, so a mark can't drift off
  its control (standards/screenshots.md).

The Keycloak guides were captured the same way. Their capture script signs in to a local Keycloak server with
credentials that are kept outside this repository, so it is not published here.
