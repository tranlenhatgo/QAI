"""
Tests for tools/registry.py — tool registration and lookup.

Covers:
- ToolRegistry.get() — find by name
- ToolRegistry.all_tools() — list all
- ToolRegistry.all_definitions() — export for LLM
- ToolRegistry.tool_names() — list names
- create_full_registry — has all 4 tools
- create_lite_registry — has only 2 tools
- RAG tool conditional inclusion
"""

import pytest

from server.tools import BaseTool
from server.tools.registry import (
    ToolRegistry,
    create_full_registry,
    create_lite_registry,
)


# ─── ToolRegistry Core ───────────────────────────────────────────────────────


class TestToolRegistry:
    def test_get_existing_tool(self):
        registry = create_lite_registry(user_id="user1")
        tool = registry.get("quiz_history")
        assert tool is not None
        assert tool.name == "quiz_history"

    def test_get_nonexistent_returns_none(self):
        registry = create_lite_registry(user_id="user1")
        assert registry.get("nonexistent") is None

    def test_all_tools_returns_list(self):
        registry = create_lite_registry(user_id="user1")
        tools = registry.all_tools()
        assert isinstance(tools, list)
        assert len(tools) > 0
        assert all(isinstance(t, BaseTool) for t in tools)

    def test_all_definitions_format(self):
        registry = create_lite_registry(user_id="user1")
        definitions = registry.all_definitions()
        assert isinstance(definitions, list)
        for defn in definitions:
            assert hasattr(defn, "name")
            assert hasattr(defn, "description")
            assert hasattr(defn, "parameters")

    def test_tool_names_returns_strings(self):
        registry = create_lite_registry(user_id="user1")
        names = registry.tool_names()
        assert isinstance(names, list)
        assert all(isinstance(n, str) for n in names)


# ─── create_full_registry ────────────────────────────────────────────────────


class TestFullRegistry:
    def test_has_quiz_history(self):
        registry = create_full_registry(user_id="user1")
        assert registry.get("quiz_history") is not None

    def test_has_recommend(self):
        registry = create_full_registry(user_id="user1")
        assert registry.get("recommend") is not None

    def test_has_reason(self):
        registry = create_full_registry(user_id="user1")
        assert registry.get("reason") is not None

    def test_has_web_search(self):
        registry = create_full_registry(user_id="user1")
        assert registry.get("web_search") is not None

    def test_no_rag_without_kb_id(self):
        """Without kb_id, RAG tool is not included."""
        registry = create_full_registry(user_id="user1", kb_id="")
        assert registry.get("rag") is None

    def test_rag_included_with_kb_id(self):
        """With kb_id, RAG tool is included."""
        registry = create_full_registry(user_id="user1", kb_id="kb123")
        rag = registry.get("rag")
        assert rag is not None

    def test_full_has_4_tools_without_rag(self):
        registry = create_full_registry(user_id="user1")
        assert len(registry.all_tools()) == 4

    def test_full_has_5_tools_with_rag(self):
        registry = create_full_registry(user_id="user1", kb_id="kb1")
        assert len(registry.all_tools()) == 5


# ─── create_lite_registry ────────────────────────────────────────────────────


class TestLiteRegistry:
    def test_has_quiz_history(self):
        registry = create_lite_registry(user_id="user1")
        assert registry.get("quiz_history") is not None

    def test_has_recommend(self):
        registry = create_lite_registry(user_id="user1")
        assert registry.get("recommend") is not None

    def test_no_reason(self):
        """Lite tier does not have the reason tool."""
        registry = create_lite_registry(user_id="user1")
        assert registry.get("reason") is None

    def test_no_web_search(self):
        """Lite tier does not have web search."""
        registry = create_lite_registry(user_id="user1")
        assert registry.get("web_search") is None

    def test_lite_has_2_tools(self):
        registry = create_lite_registry(user_id="user1")
        assert len(registry.all_tools()) == 2


# ─── Tool Definitions Contract ───────────────────────────────────────────────


class TestToolDefinitionContract:
    """Every tool must produce valid definitions for the LLM."""

    def test_all_tools_have_non_empty_name(self):
        registry = create_full_registry(user_id="user1", kb_id="kb1")
        for tool in registry.all_tools():
            assert tool.name, f"Tool has empty name: {tool}"
            assert len(tool.name) > 0

    def test_all_tools_have_description(self):
        registry = create_full_registry(user_id="user1", kb_id="kb1")
        for tool in registry.all_tools():
            assert tool.description, f"Tool '{tool.name}' has no description"

    def test_all_tools_have_parameters_schema(self):
        registry = create_full_registry(user_id="user1", kb_id="kb1")
        for tool in registry.all_tools():
            schema = tool.parameters_schema()
            assert isinstance(schema, dict), f"Tool '{tool.name}' schema is not a dict"
            assert "type" in schema, f"Tool '{tool.name}' schema missing 'type'"
