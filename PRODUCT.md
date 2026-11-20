# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

_Assumption, not yet confirmed by pawan: a phone-first responsive website. No native iOS or Android app in the MVP._

## Stack

Next.js frontend, FastAPI backend, PostgreSQL database, Clerk for auth. Planned repo layout: `frontend/`, `backend/`, `docs/`.

## Users

**Primary:** people aged 14 to 35 who enjoy football and want to know more about it. New fans, EA FC players, Fantasy Premier League players, students and casual viewers. They come for a few minutes at a time, usually on a phone, often once a day for the daily challenge.

**Secondary:** experienced fans who enjoy trivia and want to test themselves, such as club supporters, Premier League and Champions League fans, and football history enthusiasts.

The job: get better at football knowledge (countries, clubs, players, competitions, history) without it feeling like study.

## Product Purpose

Footlas teaches football through play instead of articles or videos. Users answer quiz questions, tap countries on a world map, keep a daily streak and unlock achievements, and every answer is followed by an explanation.

Football knowledge today is scattered across Wikipedia, YouTube, Reddit, Transfermarkt and live-score apps. Those tools give information; none of them help people remember it.

A successful session means the user learned something new, had fun, and wants to come back tomorrow.

## Positioning

"The Duolingo of football." The mechanism is the learning loop: play, get curious, learn something, want to play again. Every interaction teaches at least one fact, through a Learn Card shown after each answer whether it was right or wrong. It is a learning product first, not a stats, news or scores product.

## Operating Context

- Daily ritual: open the app, play the 10-question daily challenge (one attempt per day), earn XP, extend the streak, come back tomorrow.
- Free play: country and player guessing games, and map questions such as "Where is this player from?", "Which country won this World Cup?", "Which nation does this club belong to?".
- Progress lives on a profile: username, avatar, XP, level, daily streak, total questions and accuracy.
- Accounts via Clerk (email sign-up, Google login) so progress follows the user across devices.

## Capabilities and Constraints

**MVP (Phase 1, estimated 4 to 6 weeks):** auth, an SVG world map with country highlighting, country and player guessing games, the 10-question daily challenge, XP and streaks, profiles with level, Learn Cards, and achievements.

**Later:** Phase 2 adds content; Phase 3 adds optional AI features such as AI explanations; social features come after that. Future ideas include a zoomable map, difficulty levels, time attack, weekly and monthly events, hidden and seasonal achievements, and public profiles.

**Out of scope:** fantasy football, betting, live scores and crypto.

**Learning pillars:** countries, geography, clubs, players, stadiums, competitions, history, rivalries, managers, tactics, transfers, records.

**Terminology:** Learn Card (the explanation after an answer), Daily Challenge, XP, Level, Streak, Achievements.

**Undecided:**
- Where the player, club and career data comes from. _Open decision._
- Guest mode (listed as a future idea, not MVP).

## Brand Commitments

- Name: **Footlas**. _Assumption, not yet confirmed: the Notion pages also use "Football Academy"; Footlas is treated as the product name._
- Tone: playful and encouraging. Learning should never feel like studying.
- The core learning experience is always free. Money, if any, comes from optional support (donations, cosmetic extras, optional AI tools, sponsorships, later merchandise), never from locking education or maximising ads. "Earn trust before earning money."

## Evidence on Hand

- No users, testimonials, press, metrics or content dataset exist yet. Future work must not invent any.
- No logo or brand assets exist in the repo yet.
- _Assumption, not yet confirmed: the app does not use real club crests or player photos. It uses names, national flags, and its own artwork._
- Example Learn Card content exists in Notion (the Erling Haaland example on the Features page).

## Product Principles

1. **Every interaction teaches a fact.** An answer with no explanation is a wasted chance to teach.
2. **Fun before complexity.** If a feature isn't enjoyable to use, redesign it.
3. **Accessible to everyone.** A complete beginner and a lifelong fan should both enjoy it.
4. **Fast and simple on a phone.** Short sessions, quick feedback, nothing in the way of the next question.
5. **Free core, earned trust.** Never gate learning behind payment or bury it under ads.

## Accessibility & Inclusion

Audience includes teenagers and complete beginners, so copy should assume no prior football knowledge. No formal standard has been set yet; the map game must not rely on colour alone to show right and wrong answers.
