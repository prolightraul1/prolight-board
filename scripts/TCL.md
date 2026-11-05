# TCL sync runbook

How the ProLight board stays in step with the TCL reinstall board at https://tcl-reinstalls.vercel.app. That site belongs to TCL's owner.

## Rules
- The TCL site is **read only**, with one exception: marking jobs installed or not installed so they match our board (step 5). Never click save, edit, delete, or any other button that changes anything there.
- Don't call TCL's database API directly. Read only what the signed-in page shows.
- Never put customer names, addresses, prices or notes in commits, workflow inputs or logs. This repo is public.

## How a run works (browser version)
1. Open https://tcl-reinstalls.vercel.app in the browser on Raul's computer. It is already signed in there. If it shows a sign-in page, stop and tell Raul. Don't type a password.
2. Read every job on the board, including each job's detail page if the list view doesn't show everything. Build one object per job:
   ```
   { name, addr, color, price (number), when, whenFull, ready ("3/5"), prio ("high"|"medium"|"low"),
     st (status text, e.g. "Booked", "Installed"), dep, bal, layout, where, outlets, watch, crew, office, last }
   ```
   - `color` is the lights/colors line.
   - `layout` is the overview text and `where` is the "what goes where" list.
   - `outlets` is power, `watch` is anything flagged to watch out for, and `crew` is crew notes.
   - `office` is office-only notes, and `last` is last season's job.
   - Leave a field out if the page doesn't show it.
3. Collect photo and video links on each job as `{ name, url }`. Only the TCL storage (`…supabase.co/storage/v1/object/sign/job-media/…`) and `drive.google.com/thumbnail?id=…` links get copied.
4. On the TCL page, run JavaScript that POSTs to the board. The endpoint allows that site's origin.
   ```
   fetch("https://prolight-boardv1.vercel.app/api/tcl",{method:"POST",headers:{"Content-Type":"application/json"},
     body:JSON.stringify({key:KEY, jobs:[...], dry:true})}).then(r=>r.json())
   ```
   - Do a `dry:true` run first and check it. If more than about 15 jobs would change, or prices change by more than 50%, the page was probably misread. Stop and report.
   - Otherwise send it again without `dry`.
   - Media goes in separate POSTs, at most 8 items each: `{key, media:[...]}`. Skip items already copied; the endpoint answers "already there".
5. **Completion follows our board, in both directions.** Raul asked for this; it is the one thing the sync may change on TCL's site. The real (not dry) POST answers with:
   - **`markOnTcl`**: jobs where every install day is checked off on our board but TCL doesn't show them installed. Open each job's detail sheet and click **Mark installed** (`button[data-a="stage"][data-v="installed"]`).
   - **`unmarkOnTcl`**: jobs TCL shows as installed that are not complete on our board. Open each one and click **Undo** in the stage area of the detail sheet. Then confirm the pill no longer says "Installed".
   - Before clicking, set `window.confirm = () => true`, and put it back afterward.
   - Never touch priority, week, checklist, upload, or any other control.
   - If either list has more than 8 jobs, stop and report instead, because the data is probably being misread.
   - Then run the POST once more. It removes any old check-offs the sync itself had copied from TCL for jobs that are now unmarked.
6. The board compares against what TCL showed last time:
   - It only changes a field when TCL changed it, so edits made on the board are kept.
   - It records each change in the job's "Changes from TCL" history.
   - It sends Raul one push.
7. Save the extraction script you used as `scripts/tcl-extract.js`, without the key, so the next run can reuse it. If the TCL page layout changed, update the script.

## Feed version (when TCL provides one)
Set `TCL_FEED_URL` in Vercel, plus `TCL_FEED_TOKEN` if the feed needs one. The board then pulls it every 15 minutes, with no computer needed. The feed should return a JSON array of jobs in the shape above. It may also include `media: [url, …]` on each job.
