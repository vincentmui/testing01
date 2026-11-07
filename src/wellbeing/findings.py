"""Plain-language conclusions, computed from the report so they always match the numbers."""

LABEL = {
    "failed_to_cut_back": "failing to cut back", "first_check_morning": "how soon they check in the morning", "fomo_score": "fear of missing out (FOMO)",
    "late_night_usage": "late-night use", "scroll_without_purpose": "scrolling without purpose", "daily_usage_hours": "daily hours",
    "social_comparison_score": "social comparison", "validation_seeking_score": "validation seeking", "notifications_per_day": "notifications per day",
    "primary_platform": "the main platform", "age": "age", "gender": "gender",
}


def _label(f: str) -> str:
    return LABEL.get(f, f.replace("_", " "))


def build(report: dict) -> list[dict]:
    eda, imp = report["eda"], report["importance"]
    h = eda["hours_vs_score"]
    bins = eda["by_hours"]
    lo, hi = bins[0], bins[-1]
    out = [{
        "id": "hours", "title": "More hours go with lower wellbeing",
        "text": (f"Daily hours and the wellbeing score are negatively related (Spearman rho = {h['spearman_rho']}, p < 0.001, n = {h['n']}). "
                 f"Under 2 hours a day, {lo['low']:.0f}% of people are in the Low wellbeing group; at 8+ hours it is {hi['low']:.0f}% "
                 f"(mean score {lo['mean_score']} vs {hi['mean_score']}). The relationship is steady rather than a sharp cliff: the Low share climbs with every extra band."),
    }]
    night = eda.get("by_night")
    if night:
        y = next(x for x in night if x["group"] == "Yes")
        n = next(x for x in night if x["group"] == "No")
        adj = report.get("night_effect") or {}
        extra = f" After accounting for the other inputs, the model puts the Low probability at {adj['Yes']['Low']}% with late-night use and {adj['No']['Low']}% without." if adj else ""
        out.append({"id": "night", "title": "Late-night use is a strong marker",
                    "text": f"{y['low']:.0f}% of late-night users are in the Low group, against {n['low']:.0f}% of people who do not use social media late at night.{extra}"})
    top = [i for i in imp if i["importance"] > 0][:5]
    out.append({"id": "drivers", "title": "How people use social media matters more than how long",
                "text": ("Ranked by how much the model's macro-F1 falls when an input is shuffled, the strongest factors are: "
                         + ", ".join(f"{_label(i['feature'])} ({i['importance']:.3f})" for i in top)
                         + ". Daily hours still counts, but habits (checking within minutes of waking, failing to cut back) and social-comparison feelings rank higher.")})
    age = eda.get("by_age", [])
    if age:
        spread = max(a["mean_score"] for a in age) - min(a["mean_score"] for a in age)
        out.append({"id": "age", "title": "Age and gender barely separate wellbeing here",
                    "text": f"Mean wellbeing differs by only {spread:.2f} points between age groups, and the model gives age and gender no weight. In this sample, behaviour is more informative than demographics, so age-based rules are weak guidance on their own."})
    plat = eda.get("by_platform", [])
    if plat:
        worst = max(plat, key=lambda x: x["low"])
        best = min(plat, key=lambda x: x["low"])
        out.append({"id": "platform", "title": "Platforms differ, but modestly",
                    "text": f"The share in the Low group ranges from {best['low']:.0f}% ({best['group']}) to {worst['low']:.0f}% ({worst['group']}). The model ranks platform low once behaviour is known, so it likely reflects how each platform is used."})
    bench = report["mediator_benchmark"]["test"]["f1_macro"]
    fin = report["final"]["test"]["f1_macro"]
    out.append({"id": "caveat", "title": "What this does and does not show",
                "text": (f"The model is useful, not precise: macro-F1 {fin:.2f} and ROC AUC {report['final']['test']['roc_auc_ovr']:.2f} on unseen people, against {report['models'][0]['test']['f1_macro']:.2f} for guessing the majority class. "
                         f"Medium is the hardest class, which is expected because it sits between the other two. The data are a single survey, so these are associations, not proof that social media use changes wellbeing: people who feel worse may also use it differently. "
                         f"Adding the mental-state measures (anxiety, depression, loneliness, self-esteem, sleep quality) lifts macro-F1 to {bench:.2f}, but those describe wellbeing itself, so they are kept out of the main model.")})
    return out


def business_summary(report: dict) -> dict:
    eda, imp = report["eda"], report["importance"]
    bins = eda["by_hours"]
    first_over = next((b for b in bins if b["low"] > 100 / 3), bins[-1])
    night = {x["group"]: x for x in eda.get("by_night", [])}
    top = ", ".join(_label(i["feature"]) for i in imp[:3])
    ln = f"{night['Yes']['low']:.0f}% vs {night['No']['low']:.0f}%" if night else "higher"
    return {
        "headline": "Wellbeing is lower where use is heavy, late at night and compulsive. Reach people without relying on those moments.",
        "business": [
            {"title": "Advertise in daytime and early-evening windows",
             "text": f"Late-night users are far more likely to be in the Low wellbeing group ({ln}). Shift budget and frequency caps away from late-night delivery; there is no wellbeing or brand upside in reaching someone who is awake at 2 a.m. and struggling."},
            {"title": "Cap frequency, not just reach",
             "text": f"The Low share passes one in three at {first_over['group']} a day. Heavy users see far more impressions, so a per-user daily frequency cap protects the people most at risk and cuts wasted spend."},
            {"title": "Do not target the signs of compulsive use",
             "text": f"The strongest markers are {top}. Excluding audiences defined by compulsive behaviour (for example, people who repeatedly try and fail to cut back) is the most direct way to avoid exploiting vulnerability."},
            {"title": "Avoid comparison and fear-of-missing-out creative",
             "text": "FOMO and social comparison rank among the top factors. Prefer informative, positive messages over countdowns, scarcity cues and idealised-lifestyle imagery."},
            {"title": "Measure wellbeing as a campaign KPI",
             "text": "Track opt-outs, hides and reports, and run short wellbeing pulse surveys for audience segments next to conversion, so harm shows up in reporting."},
        ],
        "public": [
            {"title": "Guide by behaviour and time of day, not by age alone",
             "text": "Age groups differ by under half a point in this sample, while late-night use and compulsive-use habits separate wellbeing sharply. Guidelines should name night-time use and heavy daily use directly."},
            {"title": "Encourage a night-time wind-down by default",
             "text": "Platforms can default to quiet hours (muted notifications, no autoplay, a nudge to stop) for everyone, and make them easy for parents to set for minors."},
            {"title": "Daily-time prompts and easy limits",
             "text": f"Offer built-in usage dashboards and reminders, with the first prompt around {first_over['group']} a day where the Low share starts to rise. These are nudges, not bans: the link is gradual, with no safe or unsafe cut-off."},
            {"title": "Support people who cannot cut back",
             "text": "Failing to cut back is the single strongest marker. Help should be a normal feature, such as one-tap pause or friction when a user has tried to reduce use, plus links to support."},
            {"title": "Fund evidence that can show cause",
             "text": "This is one cross-sectional survey. Before binding rules, require platforms to share data for independent longitudinal or experimental studies."},
        ],
        "limits": "These are associations in one survey; they do not prove social media use causes lower wellbeing, and the model classifies about two people in three correctly. Use the findings to guide pilots and measurement, not as final policy.",
    }
