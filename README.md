# Can Probability Predict a Flood?

**Mumbai extreme-rainfall analysis and flood-odds calculator.** Probability and Statistics lab project by Vani Singh and Linga Chaitra.

On 26 July 2005, the Santacruz gauge in Mumbai recorded 944 mm of rain in 24 hours. This project asks whether a statistical model built only on data available before that day would have treated it as impossible or as a plannable risk.

**Answer.** The choice of model decides it. Fitted on 1950–2004 data:

| Model | Chi-square p | Return period of 944 mm |
| --- | --- | --- |
| Normal | 0.001 (rejected) | 5.4 × 10²¹ years |
| Gamma | 0.051 | 1.7 billion years |
| Gumbel | 0.217 | 4.3 million years |
| **GEV** | **0.647 (best fit)** | **308 years** (95% CI 65 to 12,299) |

## What's inside

| Path | Contents |
| --- | --- |
| `analysis/flood_analysis.ipynb` | Full workflow with outputs: cleaning, descriptive statistics, distribution fitting, hypothesis tests, regression, validation |
| `analysis/figures/` | Figures produced by the notebook |
| `data/raw/santacruz_ghcn_daily.csv` | Daily rainfall, NOAA GHCN-Daily station IN012070800, Oct 1949 to Aug 2025 |
| `data/processed/annual_series.csv` | One row per complete monsoon: annual maximum, season total, heavy-day counts |
| `docs/` | The website: interactive flood-odds calculator (GitHub Pages) |
| `docs/data/model.json` | Fitted model parameters exported by the notebook |

## Course themes covered

1. **Descriptive statistics and visualisation.** Completeness rule, the documented 2005 correction, mean/median/mode, variance, skewness, histograms and box plots.
2. **Random variables and distributions.** Normal, Gamma, Gumbel and GEV fitted by maximum likelihood with chi-square goodness of fit; Binomial and geometric return-period arithmetic; Poisson model of very heavy rain days.
3. **Hypothesis testing.** F-test, Welch t-test, Mann–Whitney, one-way ANOVA with Tukey HSD, Poisson z-test, chi-square test of independence.
4. **Regression.** Linear trends with Mann–Kendall and Newey–West checks; multiple regression of the annual maximum on year, monsoon total and wet days.
5. **Validation.** Models trained on 1950–1990 and tested on 1991–2024.

## Run it

On Windows (PowerShell):

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
jupyter notebook analysis\flood_analysis.ipynb
```

Run all cells. The notebook rewrites `data/processed/`, `analysis/figures/` and `docs/data/`.

To view the website locally, open `docs\index.html` in a browser. It needs no build step or server.

## Publish the website on GitHub Pages

1. Push this repository to GitHub.
2. Open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, then branch `main` and folder `/docs`.
4. The site goes live at `https://<your-username>.github.io/<repo-name>/`.

## Data notes

- Source: NOAA GHCN-Daily, station IN012070800 (Bombay/Santacruz). Values are daily totals in mm, each dated by the end of IMD's 8:30 am to 8:30 am window. The file was taken from a cached CSV export of this GHCN series and spot-checked against IMD-reported totals: 30 Aug 2017 reads 331.0 mm here against IMD's 331.4 mm. The official copy is at `https://www.ncei.noaa.gov/data/global-historical-climatology-network/daily/access/IN012070800.csv`; GHCN stores tenths of a mm, so divide by 10.
- A year is used only if at least 104 of its 122 June–September days are recorded. This keeps 63 of 76 years.
- GHCN stores the 2005 storm as 461 mm on 26 July and 0.0 mm on 27 July. We replaced it with IMD's published 944 mm on 27 July. The notebook documents the evidence.
- This analysis estimates rainfall probabilities at one gauge. It does not predict street-level flooding, which also depends on rainfall intensity within the day, tides and drainage.
