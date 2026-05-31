from server.capabilities.solve import (
    _correct_lambert_w_approximations,
    _principal_lambert_w_exp,
)


def test_lambert_w_exp_value_for_ten():
    assert round(_principal_lambert_w_exp(10), 3) == 7.929


def test_corrects_mismatched_lambert_w_approximation():
    text = r"\(x = W(e^{10})\) (exact), \(x \approx 7.694\)."

    corrected = _correct_lambert_w_approximations(text)

    assert r"x \approx 7.929" in corrected
    assert "7.694" not in corrected


def test_leaves_matching_lambert_w_approximation_unchanged():
    text = r"\(x = W(e^{10})\) (exact), \(x \approx 7.929\)."

    assert _correct_lambert_w_approximations(text) == text
