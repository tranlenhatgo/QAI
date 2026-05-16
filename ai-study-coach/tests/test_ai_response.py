"""
AI Study Coach — Test Script
=============================
Tests the AI response WITHOUT needing the Spring Boot backend.
Uses mock quiz data to simulate a student's history.

Usage:
    python -m tests.test_ai_response

Requires: LM Studio running with a model loaded
"""

import asyncio
import logging
import json
import sys
import time
import os

# Fix Windows console encoding for emoji/unicode
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

# ── Setup logging ──
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(message)s",
)
logger = logging.getLogger("test")


# ═══════════════════════════════════════════════════════════════════════════════
# MOCK DATA — Simulates quiz history without the Spring Boot backend
# ═══════════════════════════════════════════════════════════════════════════════

MOCK_QUIZ_HISTORY = [
    {"quizId": "q1", "quizTitle": "Math Fundamentals",     "score": "4/5", "status": "COMPLETED", "updatedAt": "2026-03-20"},
    {"quizId": "q2", "quizTitle": "World Geography",       "score": "2/5", "status": "COMPLETED", "updatedAt": "2026-03-22"},
    {"quizId": "q3", "quizTitle": "English Grammar",       "score": "5/5", "status": "COMPLETED", "updatedAt": "2026-03-25"},
    {"quizId": "q4", "quizTitle": "Science: Solar System",  "score": "1/5", "status": "COMPLETED", "updatedAt": "2026-03-27"},
    {"quizId": "q5", "quizTitle": "World Geography",       "score": "3/5", "status": "COMPLETED", "updatedAt": "2026-03-30"},
    {"quizId": "q6", "quizTitle": "History: World War II",  "score": "2/5", "status": "COMPLETED", "updatedAt": "2026-04-01"},
    {"quizId": "q7", "quizTitle": "Math Fundamentals",     "score": "5/5", "status": "COMPLETED", "updatedAt": "2026-04-03"},
]

MOCK_WEAKNESS_REPORT = {
    "weakest_categories": ["GEOGRAPHY", "SCIENCE"],
    "accuracy_by_category": {
        "MATH": 0.90,
        "ENGLISH": 1.0,
        "GEOGRAPHY": 0.50,
        "SCIENCE": 0.20,
        "HISTORY": 0.40,
    },
    "declining": ["SCIENCE"],
}


# ═══════════════════════════════════════════════════════════════════════════════
# TEST 1: Direct LLM Client Test
# ═══════════════════════════════════════════════════════════════════════════════

async def test_llm_client():
    """Test the LLM client directly with a simple prompt."""
    print("\n" + "=" * 70)
    print("TEST 1: Direct LLM Client")
    print("=" * 70)

    from server.llm.external import external_client

    # Check availability
    ext_ok = await external_client.is_available()

    print(f"   {external_client.provider}: {'✅ available' if ext_ok else '❌ unreachable'}")

    if not ext_ok:
        print("\n   ❌ No LLM available! Start LM Studio and load a model.")
        return False

    client = external_client
    client_name = f"{external_client.provider}"

    messages = [
        {"role": "system", "content": "You are a helpful study coach. Respond in 2-3 sentences."},
        {"role": "user", "content": "I got 40% on my Science quiz. What should I do?"},
    ]

    print(f"\n   📤 Sending test prompt to {client_name}...")
    start = time.time()

    try:
        response = await client.chat(messages)
        elapsed = time.time() - start

        print(f"   ⏱️ Response time: {elapsed:.1f}s")
        print(f"\n   🤖 Response:")
        print(f"   {'-' * 60}")
        for line in response.strip().split("\n"):
            print(f"   {line}")
        print(f"   {'-' * 60}")
        print(f"\n   ✅ TEST 1 PASSED — LLM client works!")
        return True
    except Exception as e:
        print(f"\n   ❌ TEST 1 FAILED — {e}")
        return False


# ═══════════════════════════════════════════════════════════════════════════════
# TEST 2: Prompt Builder with Mock Data
# ═══════════════════════════════════════════════════════════════════════════════

async def test_prompt_builder():
    """Test that the prompt builder creates correct context from mock data."""
    print("\n" + "=" * 70)
    print("TEST 2: Prompt Builder (with mock quiz data)")
    print("=" * 70)

    from server.agent.prompts import build_context_prompt, build_messages

    context = build_context_prompt(
        quiz_history=MOCK_QUIZ_HISTORY,
        weakness_report=MOCK_WEAKNESS_REPORT,
    )

    messages = build_messages(
        user_message="What are my weakest subjects?",
        context=context,
    )

    print(f"\n   📋 Context prompt ({len(context)} chars):")
    print(f"   {'-' * 60}")
    for line in context.split("\n"):
        print(f"   {line}")
    print(f"   {'-' * 60}")

    print(f"\n   📨 Message count: {len(messages)}")
    for i, msg in enumerate(messages):
        role = msg["role"]
        content_preview = msg["content"][:80].replace("\n", " ")
        print(f"   [{i}] {role}: {content_preview}...")

    # Verify context includes key data
    checks = [
        ("quiz history", "Math Fundamentals" in context),
        ("scores", "4/5" in context),
        ("weakest categories", "GEOGRAPHY" in context),
        ("accuracy bars", "🟩" in context),
        ("declining warning", "SCIENCE" in context),
    ]

    all_passed = True
    print(f"\n   Checks:")
    for name, passed in checks:
        status = "✅" if passed else "❌"
        print(f"   {status} {name}")
        if not passed:
            all_passed = False

    if all_passed:
        print(f"\n   ✅ TEST 2 PASSED — Prompt builder works correctly!")
    else:
        print(f"\n   ❌ TEST 2 FAILED — Some context data missing")
    return all_passed


# ═══════════════════════════════════════════════════════════════════════════════
# TEST 3: Full Agent Flow with Mock Data
# ═══════════════════════════════════════════════════════════════════════════════

async def test_agent_with_mock_data():
    """
    Test the full agent pipeline using mock quiz data.
    Bypasses the quiz API client by injecting data directly.
    """
    print("\n" + "=" * 70)
    print("TEST 3: Full Agent Flow (mock data → LLM response)")
    print("=" * 70)

    from server.llm.external import external_client
    from server.agent.prompts import build_context_prompt, build_messages
    from server.agent.coach import _get_llm_response

    ext_ok = await external_client.is_available()
    if not ext_ok:
        print("   ❌ No LLM available — skipping")
        return False

    # Build context from mock data (simulates what handle_chat does)
    context = build_context_prompt(
        quiz_history=MOCK_QUIZ_HISTORY,
        weakness_report=MOCK_WEAKNESS_REPORT,
    )

    test_cases = [
        "What are my weakest subjects?",
        "Create a study plan for this week.",
        "I just failed my Science quiz again. Help!",
    ]

    all_passed = True
    for i, user_msg in enumerate(test_cases):
        print(f"\n   ── Test case {i + 1}: \"{user_msg}\"")

        messages = build_messages(user_msg, context)

        start = time.time()
        try:
            response = await _get_llm_response(messages)
            elapsed = time.time() - start

            # Basic validation
            has_content = len(response.strip()) > 20
            print(f"   ⏱️ {elapsed:.1f}s | {len(response)} chars")
            print(f"   🤖 Preview: {response[:150].replace(chr(10), ' ')}...")

            if has_content:
                print(f"   ✅ Passed")
            else:
                print(f"   ❌ Response too short")
                all_passed = False

        except Exception as e:
            print(f"   ❌ Error: {e}")
            all_passed = False

    if all_passed:
        print(f"\n   ✅ TEST 3 PASSED — Full agent flow works!")
    else:
        print(f"\n   ❌ TEST 3 FAILED")
    return all_passed


# ═══════════════════════════════════════════════════════════════════════════════
# TEST 4: Streaming (WebSocket simulation)
# ═══════════════════════════════════════════════════════════════════════════════

async def test_streaming():
    """Test token-by-token streaming from the LLM."""
    print("\n" + "=" * 70)
    print("TEST 4: Streaming Response")
    print("=" * 70)

    from server.llm.external import external_client

    ext_ok = await external_client.is_available()
    if not ext_ok:
        print("   ❌ No LLM available — skipping")
        return False

    client = external_client
    client_name = external_client.provider

    messages = [
        {"role": "system", "content": "You are a study coach. Be brief."},
        {"role": "user", "content": "Give me 3 quick study tips."},
    ]

    print(f"   📤 Streaming from {client_name}...\n")
    print(f"   🤖 ", end="", flush=True)

    token_count = 0
    full_response = ""
    start = time.time()

    try:
        async for token in client.chat_stream(messages):
            print(token, end="", flush=True)
            full_response += token
            token_count += 1

        elapsed = time.time() - start
        print(f"\n\n   ⏱️ {elapsed:.1f}s | {token_count} tokens | {token_count / elapsed:.0f} tok/s")
        print(f"   ✅ TEST 4 PASSED — Streaming works!")
        return True
    except Exception as e:
        print(f"\n\n   ❌ TEST 4 FAILED — {e}")
        return False


# ═══════════════════════════════════════════════════════════════════════════════
# TEST 5: HTTP Endpoint (requires server running)
# ═══════════════════════════════════════════════════════════════════════════════

async def test_http_endpoint():
    """Test the POST /chat endpoint (requires uvicorn running on port 8000)."""
    print("\n" + "=" * 70)
    print("TEST 5: HTTP Endpoint (POST /chat)")
    print("=" * 70)

    import httpx

    base_url = "http://localhost:8000"

    # Check if server is running
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get(f"{base_url}/health")
            health = resp.json()
            print(f"   Server health: {health}")
    except Exception:
        print("   ⚠️ Server not running at localhost:8000 — skipping")
        print("   💡 Start the server with: python -m uvicorn server.main:app --reload")
        return None  # Skip, not fail

    # Send a chat request
    payload = {
        "user_id": "test_user_001",
        "message": "What should I study this week?",
        "history": [],
    }

    print(f"\n   📤 POST /chat")
    print(f"   Payload: {json.dumps(payload, indent=6)}")

    start = time.time()
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(f"{base_url}/chat", json=payload)
            elapsed = time.time() - start

            print(f"\n   📥 Status: {resp.status_code} | {elapsed:.1f}s")

            if resp.status_code == 200:
                data = resp.json()
                content = data.get("content", "")
                weaknesses = data.get("weaknesses")

                print(f"   Weaknesses: {weaknesses}")
                print(f"\n   🤖 Response:")
                print(f"   {'-' * 60}")
                for line in content[:500].split("\n"):
                    print(f"   {line}")
                if len(content) > 500:
                    print(f"   ... ({len(content)} total chars)")
                print(f"   {'-' * 60}")
                print(f"\n   ✅ TEST 5 PASSED!")
                return True
            else:
                print(f"   ❌ TEST 5 FAILED — HTTP {resp.status_code}: {resp.text[:200]}")
                return False
    except Exception as e:
        print(f"   ❌ TEST 5 FAILED — {e}")
        return False


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════════

async def main():
    print("=" * 70)
    print("   AI Study Coach — AI Response Test Suite")
    print("   Tests the LLM without needing the Spring Boot backend")
    print("=" * 70)

    results = {}

    # Test 1: LLM client connectivity
    results["LLM Client"] = await test_llm_client()

    # Test 2: Prompt builder (no LLM needed)
    results["Prompt Builder"] = await test_prompt_builder()

    # Test 3: Full agent flow with mock data
    results["Agent Flow"] = await test_agent_with_mock_data()

    # Test 4: Streaming
    results["Streaming"] = await test_streaming()

    # Test 5: HTTP endpoint (optional — needs server running)
    results["HTTP Endpoint"] = await test_http_endpoint()

    # Summary
    print("\n" + "=" * 70)
    print("   RESULTS SUMMARY")
    print("=" * 70)
    for name, result in results.items():
        if result is True:
            icon = "✅ PASS"
        elif result is False:
            icon = "❌ FAIL"
        else:
            icon = "⏭️ SKIP"
        print(f"   {icon}  {name}")

    passed = sum(1 for r in results.values() if r is True)
    failed = sum(1 for r in results.values() if r is False)
    skipped = sum(1 for r in results.values() if r is None)
    print(f"\n   {passed} passed, {failed} failed, {skipped} skipped")
    print("=" * 70)

    return failed == 0


if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)
