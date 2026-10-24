# Check 2 of GAMEPLAY 8.9 on the Fighting Styles prototype, general and Grappled situations. Run from the repo root.
cd "$(dirname "$0")/../.."
python3 tools/proto/run_sit.py tools/proto/tune_state_v7.json tools/proto/o_c2_general7.json 60 > tools/proto/c2_general7.log 2>&1
python3 tools/proto/run_sit3.py tools/proto/tune_state_v7.json tools/proto/o_c2_grappled7.json 300 > tools/proto/c2_grappled7.log 2>&1
echo done > tools/proto/c2_done
