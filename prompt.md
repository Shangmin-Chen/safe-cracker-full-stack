# Safe Cracker Full Stack - Requirements & Specification

## 1. Overview
Create a full-stack application for servicing and visualizing the `crack_safe` function.

- **Time Limit:** 2 hrs 20 min
- **Primary Goal:** Provide a robust backend API and an optimized, real-time frontend to demonstrate cracking a 10-digit safe combination using simulated physical/acoustic lock feedback (`sound_tool`).

---

## 2. Deliverables & Submission
- Git repository containing all source code (frontend, backend, tests, instructions).
- Email submission upon completion to:
  - `shaine@forml.ai`
  - `satchel@forml.ai`

---

## 3. Backend Requirements (Flask / Python)

### 3.1 Stack
- **Framework:** Flask (Python) preferred.
- **Real-Time Communication:** Server-Sent Events (SSE) or WebSockets to stream real-time cracking progress to the frontend.

### 3.2 Endpoint
- **Route:** `POST /api/crack_safe/`
- **Request Format (JSON):**
  ```json
  {
    "actual_combination": "0800666666",
    "algorithm": "positional" // optional selector: "positional" or "backtracking"
  }
  ```
  - `actual_combination`: A 10-digit numeric string representing the safe's secret combination.
- **Response Format (JSON):**
  ```json
  {
    "attempts": 123,
    "time_taken": 15.75,
    "cracked_combination": "0800666666",
    "success": true
  }
  ```

### 3.3 Cracking Logic & Algorithms
The safe cracking mechanism relies on a simulated acoustic lock-picking sensor (`sound_tool`):

1. **Helper Function — `sound_tool`:**
   - Evaluates a trial combination against the secret combination.
   - **Variant A (Positional / In-Place Matching):** Returns how many digits match the secret combination in the exact correct positions.
   - **Variant B (Multiset / Frequency Matching):** Returns the number of correct digits contained within the secret combination (regardless of position), requiring a backtracking / frequency-guided search.
   - **No Rate Limiter:** The tool can be called as rapidly as required, but each invocation increments the `attempts` counter.

2. **Main Function — `crack_safe`:**
   - **Implementation 1 (Positional Search):** Uses feedback from `sound_tool` to deduce each digit position-by-position.
   - **Implementation 2 (Backtracking / Constraint Search):** Solves the combination when `sound_tool` only provides count of matching digits without positional information.
   - Tracks:
     - `attempts`: Total number of `sound_tool` calls made.
     - `current_combination`: The combination currently being evaluated.
     - `time_taken`: Total elapsed execution time.

---

## 4. Frontend Requirements (Angular)

### 4.1 Stack & Architecture
- **Framework:** Angular.
- **Design:** Modern, optimized, responsive UI with real-time feedback.

### 4.2 Features & User Experience
- **Combination Input Form:**
  - Input field for the user to specify the target 10-digit safe combination.
  - Option to generate a random 10-digit combination.
  - Algorithm selector (Positional vs. Backtracking).
  - Submit / "Crack Safe" button.
- **Real-Time Cracking Status & Telemetry:**
  - Live animated attempt counter updating continuously as combinations are tried.
  - Display of the current combination being tested in real time.
  - Live timer showing elapsed cracking time.
  - Immediate visual freeze upon successfully cracking the safe.
- **Results Display:**
  - Final attempts count.
  - Total time taken (in seconds).
  - Verification that cracked combination matches the target combination.
- **Bonus / Custom Elements:**
  - Sound effects / visual tumblers lock animation.
  - Crack attempt history and analytics.
  - Caching / memoization optimizations.

---

## 5. Original Specification Reference (Decoded Prompt)
```text
Part 2
Create a full stack application for servicing the crack_safe function you wrote in Part 1.

Time Limit: 2 hrs 20 min

Deliverable: File upload or git repo containing your work. Please attach your work here (eg git link, file upload) or (preferred) email your submission to shaine@forml.ai and satchel@forml.ai upon completion.

Backend - 20pts
Requirements:
Flask preferred, but other python frameworks permitted.
Create an endpoint ‘/api/crack_safe/’, which accepts post requests. The request should contain a single input string field, 'actual_combination’, which similar to the function you wrote in part 1, is the true combination for the safe.
POST /api/crack_safe/ 
Input:
{
  "actual_combination": "0800666666"
}
The endpoint should return the outputs of the crack_safe function in json form.
Response:
{
  "attempts": 123,
  "time_taken": 15.75
}

Frontend - 20pts
Requirements:
Angular preferred, but other frameworks/libraries okay.
The frontend should have a form with an input element that lets a user enter the value of the actual 10-digit combination of the safe, along with a button for submitting the request to the backend.
After submitting the form and receiving results from the backend, the frontend should display the results of the crack_safe request.
Total design freedom.

Ultra bonus points:
Display in the frontend, in real time, the status of the crack_safe function. For example, update a counter on the frontend that displays how many safe combinations have been attempted so far. The counter will freeze once the safe has been cracked.
Alternatively, we’d love to see any personal design elements or efficiencies you’d like to implement. The layout above is barebones for providing the functionality to call the crack_safe function, but you are welcome to add anything and everything you may want to improve it; from caching to design elements.
```
