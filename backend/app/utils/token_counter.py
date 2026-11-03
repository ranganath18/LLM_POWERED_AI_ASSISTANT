def estimate_tokens(text: str) -> int:
    """Estimate tokens with tiktoken when available; otherwise use a rough fallback."""
    try:
        import tiktoken

        # cl100k_base is a useful approximation, but not exact for every provider/model.
        encoding = tiktoken.get_encoding("cl100k_base")
        return len(encoding.encode(text))
    except Exception:
        # Rough fallback only; do not use this for billing.
        return max(1, len(text.split()) * 2) if text.strip() else 0


def record_usage(target: dict | None, provider_usage, input_text: str, output_text: str) -> None:
    """Fill `target` with input/output token counts for one LLM call.

    Uses the real counts Groq reports (provider_usage.prompt_tokens / completion_tokens)
    and falls back to local estimates if the provider didn't send them.
    """
    if target is None:
        return
    prompt = getattr(provider_usage, "prompt_tokens", None)
    completion = getattr(provider_usage, "completion_tokens", None)
    if prompt is not None and completion is not None:
        target.update(input_tokens=prompt, output_tokens=completion, estimated=False)
    else:
        target.update(
            input_tokens=estimate_tokens(input_text),
            output_tokens=estimate_tokens(output_text),
            estimated=True,
        )
