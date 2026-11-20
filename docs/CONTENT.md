# Adding football content

All football data lives in `backend/app/seed/data/` as JSON. After editing, run
`python -m app.seed`: it updates rows in place and regenerates questions.

| File                | One entry is                                                  |
| ------------------- | ------------------------------------------------------------- |
| `countries.json`    | A football nation. `map_id` is the ISO 3166-1 numeric code of its map shape (null if too small to show) |
| `clubs.json`        | A club. Clubs with a `fact` get a "Which country?" question   |
| `players.json`      | A player and their notable career spells `[club, from, to]` (`to` is null while still there) |
| `world_cups.json`   | A World Cup final                                             |
| `champions_league.json` | A European Cup / Champions League final: `year` of the final, `season` (`2004-05`), `winner` and `runner_up` club slugs, winner-first `score`, venue and a `fact` |
| `achievements.json` | An achievement: `metric` (`correct` or `streak`), `key` and `threshold` |

Rules of thumb:

- Every fact should be true and checkable. Write it so it still reads true next season
  (prefer "won the 2024 Ballon d'Or" over "is the current Ballon d'Or holder").
- Careers list notable spells, not every loan.
- A player's `biography` becomes their Learn Card, so lead with the most interesting fact.
- A Champions League final's `winner` and `runner_up` must be slugs in `clubs.json`.
  Each final becomes a map question ("Which country's club won the YYYY Champions League
  final?") whose Learn Card names the club, score, opponent and venue. These questions
  count towards the `competition:ucl` statistic, which the Champions League Master
  achievement uses.

## Known gaps in the starter data

- The data was written from knowledge that ends in mid-2026. The **2026 World Cup** is
  not in `world_cups.json` yet, `champions_league.json` covers the finals from 1993 to
  2025 (the 2026 final and the pre-1993 European Cup finals still need adding), and
  players' current clubs need a check after the summer 2026 transfer window.
- Small nations without a shape in the 110m world map (for example Monaco, Malta and
  Andorra) can't be map answers yet. A higher-detail map would fix this.
