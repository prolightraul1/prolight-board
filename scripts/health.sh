#!/usr/bin/env bash
# Runs the Health check workflow and prints a readable summary of problems from the board's activity log.
# Usage: scripts/health.sh [hours]   (needs gh signed in with access to the repo)
set -e
H=${1:-24}; R=repos/prolightraul1/prolight-board; T=$(mktemp -d)
before=$(gh api "$R/actions/workflows/health-check.yml/runs?per_page=1" -q '.workflow_runs[0].id' 2>/dev/null || echo 0)
gh api -X POST $R/actions/workflows/health-check.yml/dispatches -f ref=main -f "inputs[hours]=$H"
for i in $(seq 1 30); do sleep 5; id=$(gh api "$R/actions/workflows/health-check.yml/runs?per_page=1" -q '.workflow_runs[0].id'); [ "$id" != "$before" ] && break; done
for i in $(seq 1 40); do [ "$(gh api $R/actions/runs/$id -q .status)" = completed ] && break; sleep 5; done
gh api $R/actions/runs/$id/logs > $T/l.zip; (cd $T && unzip -qo l.zip)
f=$(find $T -name '*Problems*.txt' | head -1)
python3 - "$f" <<'PY'
import sys,json,re
t=open(sys.argv[1]).read(); body=t.split('----BEGIN----')[-1].split('----END----')[0]
body=re.sub(r'^\S+Z ','',body.strip(),flags=re.M).strip().split('\n')[0]
d=json.loads(body)
if 'error' in d: print('ERROR',d); sys.exit(1)
print(f"last {d['hours']}h · opens {d['loads']} · avg open {d['avgLoadMs']} ms")
for p in d['problems']:
  print(f"\n[{p['type']}] x{p['count']} users={p['users']} {p['first'][:16]} → {p['last'][:16]}\n  {p['msg']}\n  src={p.get('src')} views={p['views']} devices={p['devices']} builds={p.get('builds')} ms={p.get('ms')}")
  for fr in p['stack']: print('   at',fr)
PY
