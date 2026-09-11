@echo off
cd /d "C:\Users\LENOVO\Downloads\agon-agent_2-f2762693\EduSync Pro"
"C:\Program Files\k6\k6.exe" run k6\scripts\login-api-load-test.js > k6-run-latest.out.txt 2> k6-run-latest.err.txt