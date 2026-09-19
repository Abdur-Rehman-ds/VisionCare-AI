"""Fixed, reviewed report language (Appendix C + Appendix A + FR-9).
These strings are the ONLY clinical language the system emits.
Changing them requires a spec amendment in the same PR (§21C)."""

GRADE_FINDINGS = {
    0: "No signs of diabetic retinopathy identified in this screening.",
    1: "Findings consistent with mild non-proliferative diabetic retinopathy.",
    2: "Findings consistent with moderate non-proliferative diabetic retinopathy.",
    3: "Findings consistent with severe non-proliferative diabetic retinopathy.",
    4: "Findings consistent with proliferative diabetic retinopathy.",
}

GRADE_RECOMMENDATIONS = {
    0: "Routine annual screening recommended.",
    1: "Re-screening in 6-12 months recommended; continue glycemic management.",
    2: "Referral to an ophthalmologist within 3-6 months recommended.",
    3: "Prompt ophthalmologist referral (within 1 month) recommended.",
    4: "Urgent ophthalmologist referral recommended.",
}

DISCLAIMER = (
    "VisionCare AI is a screening-assistance tool intended to support, not "
    "replace, evaluation by qualified healthcare professionals. Its outputs "
    "are algorithmic estimates and may be incorrect. All findings must be "
    "reviewed and confirmed by a licensed ophthalmologist or physician "
    "before any clinical decision is made. This software is not a certified "
    "medical device."
)
