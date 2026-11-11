# WhatchaWhen 🕰️
### An Indie 2D Pixel-Art Time Guessing Game (Stardew Valley Style)

**WhatchaWhen** is a quirky, indie 2D browser game inspired by [TimeGuessr](https://timeguessr.com/) and styled with the warm wooden aesthetic, pixel fonts, and heart health mechanics of games like **Stardew Valley**. 

Test your cultural memory across **Music**, **Books**, and **Art Pictures** powered by live public data from the **Wikipedia & Wikimedia Commons APIs**.

---

## 🌟 Key Features & Mechanics

### 1. Simple, Clean & Welcoming Interface
- Streamlined main page and uncluttered gameplay screens designed so new players immediately understand the game within seconds.
- 3-step setup on the home screen: Pick a Category, choose a Difficulty, select a Mode, and Play!

### 2. Consistent Scoring & ⚡ Streak Multipliers
- Predictable points:
  - Exact Year Guess: **5,000 Points** (predictable drop-off per year off).
  - Exact Creator & Title Guess: **5,000 Points**.
  - Perfect Round: **10,000 Points**.
- **Streak Multiplier (Double, Triple, Quadruple...)**:
  - Exact year or exact creator/title hits trigger a **Streak Multiplier** for subsequent rounds!
  - Points multiply: **1x ➔ 2x (Doubled!) ➔ 3x (Tripled!) ➔ 4x (Quadrupled!) ➔ 5x Max**!

### 3. Anti-Recycle Randomization
- Large dynamic distractor encyclopedias ensure that multiple-choice options are never recycled between rounds.
- Smart session tracking prevents seeing the same items repeating across consecutive games.

### 4. Unskippable 30-Second Commercials & WhatchaWhen GOLD Teaser
- In Normal mode, you get **1 free hint for the entire level/match**.
- To unlock a hint in a subsequent round, players must watch an unskippable 30-second retro commercial (*Joja Cola*, *Pierre’s Fertilizer*, *Krobus's Void Eggs*, *Robin’s Workshop*, *Gus's Saloon*).
- Includes an unclickable teaser button: `[ 👑 Skip Ads Forever with WhatchaWhen GOLD (Coming Soon) ]`.

### 5. Soft-Blurred Book Covers (No Spoilers)
- In the **Books** category, a soft blur filter is applied across the cover so text is illegible wherever it is placed, while iconic illustrations and cover art remain recognizable.
- Clicking the picture to open the zoom modal is disabled for books to prevent bypassing the blur.

### 6. ❤️ Forever Survival Mode (100 HP Lifeline)
- Play endlessly to see how long you can survive!
- You start with **100 HP (❤️❤️❤️❤️❤️)**.
- Inaccurate guesses deal damage; flawless hits restore health (+10 to +15 HP).
- Reach 0 HP and you collapse!

---

## 🚀 Running the Game Locally

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start Dev Server**:
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in your browser.

3. **Build for Production**:
   ```bash
   npm run build
   ```

4. **Preview Production Build**:
   ```bash
   npm run preview
   ```
