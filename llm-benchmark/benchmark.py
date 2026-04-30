#!/usr/bin/env python3
import argparse
import json
import os
import subprocess
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Tuple


@dataclass
class TaskSpec:
    task_id: str
    chapter_number: int
    block_number: int
    question_count: int


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: Any):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def read_final_json(chapter_dir: Path):
    for name in ("05-final.json", "04-final.json"):
        p = chapter_dir / name
        if p.exists():
            return read_json(p)
    return None


def load_chapters(course_root: Path):
    chapters_dir = course_root / "chapters"
    chapter_dirs = [p for p in chapters_dir.iterdir() if p.is_dir()]
    chapter_dirs.sort()
    out = []
    for idx, chapter_dir in enumerate(chapter_dirs, start=1):
        chapter = read_final_json(chapter_dir)
        if not chapter or not chapter.get("id"):
            continue
        chapter["__index"] = idx
        out.append(chapter)
    return out


def theory_blocks(chapter: dict):
    out = []
    for b in chapter.get("blocks", []):
        if not isinstance(b, dict) or b.get("type") != "theory" or not b.get("id"):
            continue
        theory = b.get("theory", {}) if isinstance(b.get("theory"), dict) else {}
        out.append(
            {
                "index": len(out) + 1,
                "id": b["id"],
                "chapter_id": chapter.get("id"),
                "title": b.get("title", ""),
                "concept_id": theory.get("concept_id", ""),
                "content_md": theory.get("content_md", ""),
                "key_points": theory.get("key_points", []),
                "common_mistakes": theory.get("common_mistakes", []),
                "examples": theory.get("examples", []),
            }
        )
    return out


def find_block(course_root: Path, chapter_number: int, block_number: int):
    chapters = load_chapters(course_root)
    for chapter in chapters:
        if int(chapter.get("__index", 0)) != chapter_number:
            continue
        for block in theory_blocks(chapter):
            if int(block["index"]) == block_number:
                return chapter, block
    raise ValueError(f"Block not found: chapter={chapter_number}, block={block_number}")


def load_system_prompt(course_root: Path):
    prompt_path = course_root / "prompts" / "16-training-pack-generator-system.md"
    if prompt_path.exists():
        return prompt_path.read_text(encoding="utf-8").strip()
    return "Ты генератор mcq_single вопросов по английской грамматике. Верни только JSON."


def build_prompt(system_prompt: str, block: dict, count: int):
    return (
        f"{system_prompt}\n\n"
        "Ограничения:\n"
        "- Генерируй только type=mcq_single\n"
        "- Каждый вопрос обязан иметь choices: ровно 4 варианта, каждый {id,text}\n"
        "- prompt и explanation пиши по-русски\n"
        "- text в choices пиши по-английски\n"
        "- Верни JSON массив объектов вопросов\n"
        f"- Сгенерируй ровно {count} вопросов\n\n"
        f"INPUT:\n{json.dumps(block, ensure_ascii=False)}"
    )


def _openai_chat_generate(base_url: str, model: str, prompt: str, timeout_s: int, api_key: str):
    base = base_url.rstrip("/")
    body = json.dumps(
        {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.3,
            "stream": False,
        }
    ).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    req = urllib.request.Request(f"{base}/v1/chat/completions", data=body, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=timeout_s) as resp:
        payload = json.loads(resp.read().decode("utf-8"))
    content = payload.get("choices", [{}])[0].get("message", {}).get("content", "[]")
    return content, "openai-compatible"


def _ollama_generate(base_url: str, model: str, prompt: str, timeout_s: int):
    base = base_url.rstrip("/")
    body = json.dumps({"model": model, "prompt": prompt, "stream": False}).encode("utf-8")
    req = urllib.request.Request(f"{base}/api/generate", data=body, headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=timeout_s) as resp:
        payload = json.loads(resp.read().decode("utf-8"))
    return payload.get("response", "[]"), "ollama"


def llm_generate(base_url: str, model: str, prompt: str, timeout_s: int, api_key: str):
    try:
        return _openai_chat_generate(base_url, model, prompt, timeout_s, api_key)
    except urllib.error.HTTPError as e:
        if e.code not in (404, 405):
            raise
    return _ollama_generate(base_url, model, prompt, timeout_s)


def run_shell(command: str, check: bool = True):
    cmd = os.path.expandvars(command)
    proc = subprocess.run(cmd, shell=True, text=True, capture_output=True)
    if check and proc.returncode != 0:
        raise RuntimeError(
            f"command failed rc={proc.returncode}: {cmd}\nstdout:\n{proc.stdout}\nstderr:\n{proc.stderr}"
        )
    return proc


def wait_http_ok(url: str, timeout_s: int):
    t0 = time.perf_counter()
    last_err = ""
    while time.perf_counter() - t0 < timeout_s:
        try:
            with urllib.request.urlopen(url, timeout=3) as resp:
                if 200 <= int(resp.status) < 500:
                    return
        except Exception as e:
            last_err = str(e)
        time.sleep(0.5)
    raise RuntimeError(f"wait timeout for {url}: {last_err}")


def setup_scenario_runtime(scenario: dict):
    if scenario.get("stop_before_cmd"):
        run_shell(str(scenario["stop_before_cmd"]), check=False)
    if scenario.get("start_cmd"):
        run_shell(str(scenario["start_cmd"]), check=True)
    if scenario.get("start_sleep_s"):
        time.sleep(float(scenario.get("start_sleep_s", 0)))
    if scenario.get("wait_url"):
        wait_http_ok(str(scenario["wait_url"]), int(scenario.get("wait_timeout_s", 120)))


def teardown_scenario_runtime(scenario: dict):
    if scenario.get("stop_cmd"):
        run_shell(str(scenario["stop_cmd"]), check=False)


def parse_question_count(raw_text: str) -> Tuple[int, str]:
    try:
        parsed = json.loads(raw_text)
    except Exception as e:
        return 0, f"json_parse_error: {e}"
    if not isinstance(parsed, list):
        return 0, f"payload_not_list: {type(parsed)}"
    return len(parsed), ""


def run_one_task(course_root: Path, system_prompt: str, scenario: dict, task: TaskSpec):
    chapter, block = find_block(course_root, task.chapter_number, task.block_number)
    prompt = build_prompt(system_prompt, block, task.question_count)
    api_key = str(scenario.get("api_key", "")).strip()
    t0 = time.perf_counter()
    try:
        raw, backend = llm_generate(
            base_url=str(scenario["base_url"]),
            model=str(scenario["model"]),
            prompt=prompt,
            timeout_s=int(scenario.get("timeout_s", 900)),
            api_key=api_key,
        )
        latency = time.perf_counter() - t0
        count, parse_error = parse_question_count(raw)
        ok = parse_error == ""
        return {
            "task_id": task.task_id,
            "chapter_number": task.chapter_number,
            "block_number": task.block_number,
            "chapter_id": chapter.get("id"),
            "block_id": block.get("id"),
            "latency_s": round(latency, 3),
            "questions_returned": count,
            "target_questions": task.question_count,
            "ok": ok,
            "error": parse_error,
            "backend": backend,
        }
    except Exception as e:
        latency = time.perf_counter() - t0
        return {
            "task_id": task.task_id,
            "chapter_number": task.chapter_number,
            "block_number": task.block_number,
            "latency_s": round(latency, 3),
            "questions_returned": 0,
            "target_questions": task.question_count,
            "ok": False,
            "error": str(e),
            "backend": "error",
        }


def run_scenario(course_root: Path, system_prompt: str, scenario: dict, tasks: List[TaskSpec]):
    mode = str(scenario.get("mode", "sequential")).strip().lower()
    workers = int(scenario.get("workers", 4))
    start = 0.0
    rows = []
    print(
        f"start scenario `{scenario['name']}`: mode={mode}, tasks={len(tasks)}, "
        f"base_url={scenario.get('base_url')}, model={scenario.get('model')}",
        flush=True,
    )
    setup_error = ""
    try:
        try:
            setup_scenario_runtime(scenario)
        except Exception as e:
            setup_error = f"runtime_setup_failed: {e}"
            print(f"  !! setup failed: {setup_error}", flush=True)
        if not setup_error:
            start = time.perf_counter()
            if mode == "parallel":
                with ThreadPoolExecutor(max_workers=workers) as ex:
                    futs = {}
                    for t in tasks:
                        print(
                            f"  -> queued {t.task_id}: chapter={t.chapter_number}, block={t.block_number}, n={t.question_count}",
                            flush=True,
                        )
                        fut = ex.submit(run_one_task, course_root, system_prompt, scenario, t)
                        futs[fut] = t
                    done_count = 0
                    for fut in as_completed(futs):
                        rows.append(fut.result())
                        done_count += 1
                        r = rows[-1]
                        status = "ok" if r.get("ok") else "fail"
                        print(
                            f"  <- done {r['task_id']}: {status}, latency={r['latency_s']}s, "
                            f"questions={r['questions_returned']} ({done_count}/{len(tasks)})",
                            flush=True,
                        )
            else:
                for i, t in enumerate(tasks, start=1):
                    print(
                        f"  -> start {t.task_id}: chapter={t.chapter_number}, block={t.block_number}, "
                        f"n={t.question_count} ({i}/{len(tasks)})",
                        flush=True,
                    )
                    r = run_one_task(course_root, system_prompt, scenario, t)
                    rows.append(r)
                    status = "ok" if r.get("ok") else "fail"
                    print(
                        f"  <- done {t.task_id}: {status}, latency={r['latency_s']}s, "
                        f"questions={r['questions_returned']} ({i}/{len(tasks)})",
                        flush=True,
                    )
        else:
            start = time.perf_counter()
            for t in tasks:
                rows.append(
                    {
                        "task_id": t.task_id,
                        "chapter_number": t.chapter_number,
                        "block_number": t.block_number,
                        "latency_s": 0.0,
                        "questions_returned": 0,
                        "target_questions": t.question_count,
                        "ok": False,
                        "error": setup_error,
                        "backend": "setup-error",
                    }
                )
    finally:
        teardown_scenario_runtime(scenario)
    elapsed = time.perf_counter() - start
    rows.sort(key=lambda r: r["task_id"])
    ok_count = sum(1 for r in rows if r.get("ok"))
    total_questions = sum(int(r.get("questions_returned", 0)) for r in rows)
    return {
        "name": scenario["name"],
        "description": scenario.get("description", ""),
        "base_url": scenario.get("base_url"),
        "model": scenario.get("model"),
        "mode": mode,
        "workers": workers if mode == "parallel" else 1,
        "elapsed_s": round(elapsed, 3),
        "tasks_total": len(rows),
        "tasks_ok": ok_count,
        "questions_total": total_questions,
        "questions_per_sec": round(total_questions / elapsed, 3) if elapsed > 0 else 0.0,
        "rows": rows,
        "note": scenario.get("note", ""),
        "runtime": {
            "start_cmd": scenario.get("start_cmd", ""),
            "stop_cmd": scenario.get("stop_cmd", ""),
            "wait_url": scenario.get("wait_url", ""),
        },
    }


def render_summary_md(results: List[dict], started_at: str):
    lines = [
        f"# LLM Benchmark Summary",
        "",
        f"- Started at: `{started_at}`",
        "",
        "## Scenarios",
        "",
        "| Scenario | Mode | Time (s) | Tasks ok/total | Questions total | Q/s |",
        "|---|---:|---:|---:|---:|---:|",
    ]
    for r in results:
        lines.append(
            f"| `{r['name']}` | `{r['mode']}` | {r['elapsed_s']} | {r['tasks_ok']}/{r['tasks_total']} | {r['questions_total']} | {r['questions_per_sec']} |"
        )
    lines.append("")
    lines.append("## Per-task details")
    lines.append("")
    for r in results:
        lines.append(f"### {r['name']}")
        lines.append("")
        lines.append("| Task | Ch/Block | Latency (s) | Questions | Status | Error |")
        lines.append("|---|---:|---:|---:|---:|---|")
        for row in r["rows"]:
            st = "ok" if row.get("ok") else "fail"
            err = str(row.get("error", "")).replace("|", "\\|")
            lines.append(
                f"| `{row['task_id']}` | {row.get('chapter_number')}/{row.get('block_number')} | {row['latency_s']} | {row['questions_returned']} | {st} | {err} |"
            )
        if r.get("note"):
            lines.append("")
            lines.append(f"- Note: {r['note']}")
        lines.append("")
    return "\n".join(lines) + "\n"


def main():
    parser = argparse.ArgumentParser(description="Benchmark LLM backends for training question generation")
    parser.add_argument("--course-root", default="..")
    parser.add_argument("--scenarios", default="scenarios.json")
    parser.add_argument("--tasks", default="tasks.json")
    parser.add_argument("--only", default="", help="Comma-separated scenario names")
    parser.add_argument("--out-dir", default="results")
    args = parser.parse_args()

    base_dir = Path(__file__).resolve().parent
    course_root = (base_dir / args.course_root).resolve()
    scenarios_cfg = read_json((base_dir / args.scenarios).resolve())
    tasks_cfg = read_json((base_dir / args.tasks).resolve())
    only = {s.strip() for s in args.only.split(",") if s.strip()}
    scenarios = [s for s in scenarios_cfg.get("scenarios", []) if (not only or s.get("name") in only)]
    if not scenarios:
        raise SystemExit("No scenarios selected")

    tasks = [
        TaskSpec(
            task_id=str(t["task_id"]),
            chapter_number=int(t["chapter_number"]),
            block_number=int(t["block_number"]),
            question_count=int(t.get("question_count", 10)),
        )
        for t in tasks_cfg.get("tasks", [])
    ]
    if not tasks:
        raise SystemExit("No tasks configured")

    started_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    system_prompt = load_system_prompt(course_root)
    results = []
    for sc in scenarios:
        print(f"\n=== Scenario: {sc['name']} ({sc.get('mode', 'sequential')}) ===", flush=True)
        r = run_scenario(course_root, system_prompt, sc, tasks)
        print(
            f"done: time={r['elapsed_s']}s, ok={r['tasks_ok']}/{r['tasks_total']}, "
            f"questions={r['questions_total']}, qps={r['questions_per_sec']}",
            flush=True,
        )
        results.append(r)

    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_root = (base_dir / args.out_dir / stamp).resolve()
    out_root.mkdir(parents=True, exist_ok=True)
    payload = {"started_at": started_at, "course_root": str(course_root), "results": results}
    write_json(out_root / "results.json", payload)
    (out_root / "summary.md").write_text(render_summary_md(results, started_at), encoding="utf-8")
    print(f"\nSaved:\n- {out_root / 'results.json'}\n- {out_root / 'summary.md'}", flush=True)


if __name__ == "__main__":
    main()
