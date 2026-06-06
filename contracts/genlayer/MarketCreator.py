# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *

import json


class MarketCreator(gl.Contract):
    def __init__(self):
        pass

    @gl.public.write
    def propose(
        self,
        title: str,
        summary: str,
        source_url: str,
        category_hint: str,
        published_at: str,
    ) -> str:
        if not source_url:
            return json.dumps(
                {
                    "suitable": False,
                    "question": "",
                    "category": "ECONOMY",
                    "resolutionCriteria": "Rejected: missing source URL.",
                    "resolutionSourceUrl": "",
                    "resolutionMode": "GENLAYER",
                    "durationDays": 7,
                    "resolvesAtReason": "No source URL was provided.",
                    "initialProbabilityYes": 50,
                    "reasoning": "Rejected because a named source URL is required.",
                },
                sort_keys=True,
            )

        def nondet() -> str:
            response = gl.nondet.web.get(source_url)
            source_body = response.body.decode("utf-8")
            prompt = f"""
You are creating one binary YES/NO prediction market from a news source.

Source URL: {source_url}
Published at: {published_at}
Category hint: {category_hint}
Title: {title}
Summary: {summary}

Source page content:
{source_body}

Rules:
- Reject if no source URL.
- Reject subjective markets.
- Reject if no clear future event or measurable claim.
- Reject if resolution depends on rumours, private info, pure opinion, or unclear sources.
- Question must be binary YES/NO.
- Resolution criteria must name the exact source and exact condition.
- durationDays must match the event type.
- initialProbabilityYes must be 0-100.
- If uncertain, use 40-60.
- Never use exactly 50 unless there is truly no useful signal.
- Breaking news: 1-3 days.
- Sports/scheduled match: event end + 1 day.
- Politics/election: 7-30 days.
- Economy/CBN/inflation/FX: 7-45 days.
- Commodities/oil/fuel: 7-30 days.
- Security/conflict: 3-14 days.
- Tech/company/product: 3-21 days.
- If no sensible resolution window exists, suitable=false.

Respond only with valid JSON matching this shape:
{{
  "suitable": boolean,
  "question": string,
  "category": "FOREX" | "POLITICS" | "SPORTS" | "ECONOMY" | "SECURITY" | "COMMODITIES" | "TECH",
  "resolutionCriteria": string,
  "resolutionSourceUrl": string,
  "resolutionMode": "GENLAYER",
  "durationDays": integer,
  "resolvesAtReason": string,
  "initialProbabilityYes": integer,
  "reasoning": string
}}
"""
            result = gl.nondet.exec_prompt(prompt).replace("```json", "").replace("```", "").strip()
            return json.dumps(json.loads(result), sort_keys=True)

        return gl.eq_principle.strict_eq(nondet)
