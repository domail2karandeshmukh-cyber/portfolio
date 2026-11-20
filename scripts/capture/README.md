# Capture and annotation

How the screenshots of real products are made, so that each one can be made again.

- `mlflow_capture.py` opens MLflow 3.18.0 on the KC1 project's tracking database, takes each screen of the guide
  "Compare the KC1 model candidates in MLflow" at 1,280 x 800, and records the box of every control that a step names.
- `jupyterlab_capture.py` opens JupyterLab 4.6.6 on the sample notebook of the guide "Run a notebook from a clean start
  and share it as HTML in JupyterLab", takes each screen at 1,280 x 800, exports the notebook as HTML twice (with
  **Sanitize HTML output** selected and cleared), and writes what it saw to `evidence.json`. Its server runs on
  127.0.0.1 with the token turned off for the capture only.
- `annotate.py` draws the house marks on those boxes with the site's own Screenshot Studio, so a mark can't drift off
  its control (standards/screenshots.md).

The Keycloak guides were captured the same way. Their capture script signs in to a local Keycloak server with
credentials that are kept outside this repository, so it is not published here.
