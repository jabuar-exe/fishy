# IAPLC reference data

Scraped 13 September 2026 from https://iaplc.com/e/ (English site of the International Aquatic Plants Layout Contest, run by Aqua Design Amano Co., Ltd.).

## Copyright and permitted use

The gallery states: *"The copyright of IAPLC entries belongs to Aqua Design Amano Co., Ltd. Use of any entry work on publications and/or internet without consent of Aqua Design Amano Co., Ltd. is strictly prohibited."*

This folder is a **local research reference only**. Do not ship, host, or embed these images in the Fishy site or any demo. Use them to evaluate reconstruction, study composition, and derive rules. `images/` is git-ignored for that reason. Metadata (rank, name, country) is factual public information and is fine to keep in the repo.

## Files

| File | Content |
| --- | --- |
| `entries.csv` / `entries.json` | Every ranked entry 2018–2025: year, rank, entrant name, native-script name, country, application ID, preview image URL. The `award` column is empty (see below). |
| `entries_<year>.json` | Same, per year. |
| `grand_prize_works.json` | Grand Prize winner, title and full-size image URL for every year 2001–2025. |
| `images/<year>/<rank>_<app_id>.jpg` | 1920×1080 preview JPEGs for the top 60 of each year (git-ignored). |
| `scrape_iaplc.py` | Re-runnable scraper. `--images-top N` controls image download. |

## How the site works (for re-scraping)

- WordPress marketing pages live under `/e/`, `/j/`, `/c/` with a working REST API at `/e/wp-json/wp/v2/posts` (news only, no entry data).
- The gallery at `/gallery/en/` is a separate PHP app. Year, country, award and rank filters are set with a `POST` to `/gallery/en/` (`db_year`, `country`, `award`, `rank`) and stored in a PHP session cookie. `GET /gallery/en/index?page=N` then paginates 30 entries per page (about 10 pages per year).
- Each entry's image is served by `/gallery/en/image/preview?prefix=<yearcode>&app_id=<id>` at 1920×1080 (served with a `text/html` content type, but the bytes are JPEG). No larger size is exposed.
- Per-entry data is only rank, name, country and image. The site publishes **no** tank dimensions, plant lists, fish lists, or equipment. The award filter (values 1–7: Grand, Gold, Silver, Bronze, Honor, Winning Work, Fine Works) is applied only on the first response page and ignored on `index?page=N`, so award tier could not be scraped reliably and the column is left empty. Ranking order still reflects placement (rank 1 is the Grand Prize).
- The gallery keeps the selected year in a PHP session cookie. Reusing one session across years leaked the previous filter, so the scraper opens a fresh session per year.
- Years before 2018 are not in the gallery; only Grand Prize works go back to 2001.
- Ranks with gaps (for example 2025 has 295 entries with ranks up to 300) are withdrawn or disqualified entries.

## Contest facts

- Started 2001 with 557 entries from 19 countries; now roughly 2,000 entries a year from 60+ countries.
- 2026 schedule: entries 1 April–31 May, top 300 announced 29 August, final results 10 October.
- Entry photo rules: one JPEG under 5 MB, at least 1500 px wide, whole tank shot straight from the front, no cropping, flipping or retouching. No tank size limit. Plants above the waterline disqualify the entry.
- Prizes: Grand Prize ¥1,000,000, then Gold, Silver, Bronze, Honor, Winning Work, Fine Works tiers.

## Judging criteria (secondary screening, 100 points)

| Criterion | Points | What judges look at |
| --- | --- | --- |
| Recreation of natural habitat for fish | 50 | Healthy fish habitat; convincing underwater environment; condition of fish and plants; fish type, size and ecology fit the layout |
| Long-term maintenance | 10 | Could this aquascape be kept for a long time, or was it staged for the photo |
| Creator's technical skills | 10 | Techniques in creating and maintaining the layout |
| Originality and impression | 10 | Creativity, perfection, attractiveness |
| Natural atmosphere | 10 | Ecosystem-based expression, sense of time passing, personal interpretation of nature |
| Composition and planting balance | 10 | Completeness of the composition, balance of planting |

Process: the steering committee picks a top 100, each of the 10 judges rank-scores those 1–100 (their number one gets a 10-point Best Aquarium bonus), then each judge scores their own top 10 with the table above. Final score is the sum.

## 2026 judges

Adip Sajjan Raj (India), Albert Connelly Jr. (USA, Tropical Fish Hobbyist), André Longarço (Brazil), Jiangang Diao (China), Jörg Buhlmann (Germany), Oliver Lucanus (Canada), Shogo Yamaguchi (Japan, AQUA LIFE), Ulrike Bauer (Germany, caridina), Yu-Fa Huang (Chinese Taipei), Yusuke Homma (Japan, ADA).
