# Health watch runbook

What the scheduled health check does on each run.

1. `scripts/health.sh 8` runs the **Health check** workflow and prints the problems from the board's activity log for the last 8 hours. It covers crashes, failed saves, slow screens and slow opens, grouped, with customer details scrubbed out.
2. Decide what is real:
   - **Fix:** a crash or failed save that comes from our code, any problem that repeats, or one that hits more than one person.
   - **Ignore:**
     - one-off network blips ("Load failed", offline).
     - browser-extension noise.
     - a single `lag` under 1 s.
     - anything whose `builds` are all older than the current `<meta name="build">` stamp in index.html, when that code has since changed.
3. To fix:
   - Edit the sources in `build/`. Never hand-edit index.html: it is generated.
   - `base.html` is the original app. Each `phaseN.py` patches it with `rep(old,new)`, and `phaseN.js` holds new code.
   - Prefer adding a small new `phaseNN.py` (and `.js` if needed), hooked into `build/build.py` after the last one, over editing old phases.
   - Then run `python3 build/build.py`.
   - Server code lives in `api/` and the shared client in `platform.js`.
4. Test with `node scripts/smoke/smoke.js`. It must print `ok` for all three users. Add a check to it for the bug you fixed.
5. Ship:
   - Commit to `main` with a clear message, then push.
   - Vercel deploys on its own. Wait for the commit status to be `success`.
   - Open phones pick up the new build automatically.
6. Report only when something was fixed or needs the owner, in plain words with no code. If everything was clean, stay quiet.

Rules:
- Never put customer names, addresses, phones, emails or notes into commits, workflow inputs or logs. The repo is public.
- Never change data on the live board, in Jobber or on TCL's site to "fix" a problem. Code fixes only.
- Never ask for or print keys or secrets.
- If a fix is risky, touches money or pay math, or you can't reproduce the problem, don't ship it. Report it instead.
