import asyncio
import json

from server.llm.base import ChunkType, Message, Role
from server.llm.deepseek import DeepSeekProvider


def _run(coro):
    return asyncio.run(coro)


def test_deepseek_stream_requests_usage_and_captures_cache_tokens(monkeypatch):
    sent_payload = {}

    class FakeResponse:
        def raise_for_status(self):
            return None

        async def aiter_lines(self):
            yield "data: " + json.dumps(
                {
                    "choices": [
                        {
                            "delta": {"content": "hello"},
                            "finish_reason": None,
                        }
                    ]
                }
            )
            yield "data: " + json.dumps(
                {
                    "choices": [
                        {
                            "delta": {},
                            "finish_reason": "stop",
                        }
                    ]
                }
            )
            yield "data: " + json.dumps(
                {
                    "choices": [],
                    "usage": {
                        "prompt_tokens": 12,
                        "completion_tokens": 3,
                        "total_tokens": 15,
                        "prompt_cache_hit_tokens": 8,
                        "prompt_cache_miss_tokens": 4,
                    },
                }
            )
            yield "data: [DONE]"

    class FakeStream:
        async def __aenter__(self):
            return FakeResponse()

        async def __aexit__(self, exc_type, exc, traceback):
            return None

    class FakeClient:
        def __init__(self, timeout):
            self.timeout = timeout

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, traceback):
            return None

        def stream(self, method, url, json, headers):
            sent_payload.update(json)
            return FakeStream()

    monkeypatch.setattr("server.llm.deepseek.httpx.AsyncClient", FakeClient)

    async def collect_chunks():
        provider = DeepSeekProvider(api_key="test-key", model="deepseek-chat")
        return [
            chunk
            async for chunk in provider.complete(
                messages=[Message(role=Role.USER, content="Hi")],
            )
        ]

    chunks = _run(collect_chunks())

    assert sent_payload["stream"] is True
    assert sent_payload["stream_options"] == {"include_usage": True}
    assert [chunk.content for chunk in chunks if chunk.type == ChunkType.CONTENT] == [
        "hello"
    ]

    finish = chunks[-1]
    assert finish.type == ChunkType.FINISH
    assert finish.finish_reason == "stop"
    assert finish.usage["prompt_cache_hit_tokens"] == 8
    assert finish.usage["prompt_cache_miss_tokens"] == 4

