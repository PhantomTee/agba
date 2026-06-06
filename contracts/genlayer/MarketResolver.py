# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *

import json


class MarketResolver(gl.Contract):
    def __init__(self):
        pass

    @gl.public.write
    def resolve(
        self,
        question: str,
        resolution_criteria: str,
        resolution_source_url: str,
        resolves_at: str,
    ) -> str:
        if not resolution_source_url:
            return json.dumps(
                {
                    "outcome": "UNKNOWN",
                    "confidence": 0,
                    "evidence": "No resolution source URL was provided.",
                    "sourceUsed": "",
                    "reasoning": "A named source is required for GenLayer resolution.",
                },
                sort_keys=True,
            )

        def nondet() -> str:
            response = gl.nondet.web.get(resolution_source_url)
            source_body = response.body.decode("utf-8")
            prompt = f"""
Resolve this prediction market using only the named source.

Question: {question}
Resolution criteria: {resolution_criteria}
Resolution source URL: {resolution_source_url}
Scheduled resolution time: {resolves_at}

Named source page content:
{source_body}

Rules:
- Resolve YES only if the named source clearly confirms the criteria.
- Resolve NO only if the named source clearly contradicts the criteria.
- Return UNKNOWN if the source is unreachable, blocked, ambiguous, paywalled, login-only, stale, or insufficient.
- Never guess.

Respond only with valid JSON matching this shape:
{{
  "outcome": "YES" | "NO" | "UNKNOWN",
  "confidence": number,
  "evidence": string,
  "sourceUsed": string,
  "reasoning": string
}}
"""
            result = gl.nondet.exec_prompt(prompt).replace("```json", "").replace("```", "").strip()
            return json.dumps(json.loads(result), sort_keys=True)

        return gl.eq_principle.strict_eq(nondet)
