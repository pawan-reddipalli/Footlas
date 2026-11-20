# Footlas database schema

PostgreSQL 16, managed with SQLAlchemy 2 models and Alembic migrations in `backend/`.
The tables follow the Notion "Database Schema" page and are grouped by domain, one
`models.py` per domain under `backend/app/domains/`. [ARCHITECTURE.md](ARCHITECTURE.md)
maps each Notion table name to its table.

## Diagram

```mermaid
erDiagram
    %% Football domain
    countries ||--o{ clubs : "based in"
    countries ||--o{ players : "nationality"
    countries ||--o{ world_cups : "won"
    clubs ||--o{ players : "current club"
    players ||--o{ career_history : "career"
    clubs ||--o{ career_history : "spells"

    %% Gameplay domain
    quiz_questions ||--o{ quiz_answers : "answered as"
    daily_challenges ||--o{ quiz_answers : "daily attempt"

    %% User domain
    users ||--|| user_progress : "xp and streak"
    users ||--o{ user_statistics : "counters"
    users ||--o{ user_achievements : "unlocked"
    achievements ||--o{ user_achievements : "unlocked by"
    users ||--o{ quiz_answers : "gave"

    users {
        int id PK
        string auth_id UK "Clerk user id"
        string username UK
        string plan "free | supporter | pro"
    }
    user_progress {
        int user_id PK, FK
        int xp ">= 0"
        int current_streak ">= 0"
        int longest_streak ">= current_streak"
        date last_daily_date
    }
    players {
        int id PK
        string slug UK
        int nationality_id FK
        int current_club_id FK
        string position "GK | DF | MF | FW"
    }
    quiz_questions {
        int id PK
        string source_key UK
        string mode "map | player"
        int difficulty "1 to 5"
        jsonb answer "never sent before answering"
        jsonb learn "Learn Card"
        jsonb topics "statistic keys"
    }
    daily_challenges {
        int id PK
        date day UK
        jsonb question_ids "ordered list of 10"
    }
```

## Rules the database enforces

These are CHECK constraints, so a bug in the API or a hand-written SQL fix can't store
an impossible row. They are named `ck_<table>_<rule>`.

| Table | Rule |
| --- | --- |
| `countries` | `confederation` is one of UEFA, CONMEBOL, CONCACAF, CAF, AFC, OFC; `world_cup_titles >= 0` |
| `clubs` | `founded` is empty or after 1800 |
| `players` | `position` is GK, DF, MF or FW |
| `career_history` | `end_year` is empty (still there) or not before `start_year` |
| `quiz_questions` | `mode` is `map` or `player`; `difficulty` is 1 to 5 |
| `daily_challenges` | `question_ids` is a JSON array |
| `quiz_answers` | `xp_awarded >= 0`; one answer per user, daily challenge and question |
| `users` | `plan` is `free`, `supporter` or `pro`; `auth_id` and `username` are unique |
| `user_progress` | `xp >= 0`; `current_streak >= 0`; `longest_streak >= current_streak` |
| `user_statistics` | `0 <= correct <= answered`; one row per user and key |
| `achievements` | `metric` is `correct` or `streak`; `threshold > 0` |

Every foreign key has an index, because Postgres doesn't add one on its own.
`tests/test_schema.py` fails if a new foreign key has none.

## Changing the schema

1. Edit the model in `backend/app/domains/<domain>/models.py`.
2. From `backend/`, run `alembic revision --autogenerate -m "what changed"` and read
   the generated file. Autogenerate does not see CHECK constraints, so add
   `op.create_check_constraint(...)` by hand for any new one.
3. Run `alembic upgrade head`, then `alembic check` (it should say no new operations),
   then `pytest`.
4. Never edit a migration that has run on a shared database; add a new one.

CI runs `alembic upgrade head`, `alembic check`, a full downgrade and upgrade again, so
a migration that can't be undone fails the build.

## Not in the MVP yet

From the Notion "Future Tables" list: managers, stadiums, competitions, referees,
transfers, seasons, matches. They go in the football domain. `daily_challenges.question_ids`
is a JSONB list for now; if daily challenges ever need per-question metadata, move it to a
`daily_challenge_questions` join table.
