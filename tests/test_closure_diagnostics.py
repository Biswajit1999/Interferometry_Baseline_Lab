"""Physics-aware synthetic regression tests for EHT closure diagnostics."""
import math
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
from closure_diagnostics import (Visibility, closure_amplitudes, closure_phases,
                                 leave_one_hour_out_uv, read_visibilities,
                                 uv_sampling_moments)


def fixture(phases=None, gains=None, time=1.0):
    """Synthetic four-station complete array, with optional station gains."""
    phases = phases or {"A": 0, "B": 0, "C": 0, "D": 0}
    gains = gains or {"A": 1, "B": 1, "C": 1, "D": 1}
    amps = {"AB": 3, "AC": 2, "AD": 1.2, "BC": 4, "BD": 1.5, "CD": 2.5}
    intrinsic = {"AB": 30, "AC": -20, "AD": 50, "BC": 10, "BD": -40, "CD": 15}
    rows = []
    for i, (key, amp) in enumerate(amps.items()):
        a, b = key
        measured_amp = amp * gains[a] * gains[b]
        measured_phase = intrinsic[key] + phases[a] - phases[b]
        rows.append(Visibility(time, a, b, 1e9 + i * 2e8, (-1)**i * (3e9 + i * 1e8),
                               measured_amp, measured_phase, measured_amp / 30))
    return rows


class ClosurePhaseTests(unittest.TestCase):
    def test_station_phase_invariance(self):
        first = closure_phases(fixture())
        second = closure_phases(fixture(phases={"A": 37, "B": -71, "C": 105, "D": 8}))
        self.assertEqual(len(first), 4)
        for a, b in zip(first, second):
            self.assertAlmostEqual(a["closure_phase_deg"], b["closure_phase_deg"], places=11)
            self.assertAlmostEqual(a["thermal_sigma_deg"], b["thermal_sigma_deg"])

    def test_triangle_phase_orientation(self):
        rows = [Visibility(0, "A", "B", 1, 2, 1, 30, .01),
                Visibility(0, "B", "C", 2, 3, 1, 20, .01),
                Visibility(0, "A", "C", 3, 4, 1, 10, .01)]
        result = closure_phases(rows)
        self.assertEqual(len(result), 1)
        self.assertAlmostEqual(result[0]["closure_phase_deg"], 40)

    def test_missing_and_low_snr_are_excluded(self):
        rows = fixture()[:-1]
        self.assertLess(len(closure_phases(rows)), 4)
        self.assertEqual(closure_phases(fixture(), min_snr=100), [])

    def test_high_snr_thermal_phase_uncertainty(self):
        result = closure_phases(fixture())
        self.assertAlmostEqual(result[0]["thermal_sigma_deg"],
                               math.degrees(math.sqrt(3) / 30), places=10)


class ClosureAmplitudeTests(unittest.TestCase):
    def test_station_amplitude_gain_invariance(self):
        baseline = closure_amplitudes(fixture())
        gained = closure_amplitudes(fixture(gains={"A": 0.3, "B": 2.5, "C": 1.1, "D": 0.7}))
        self.assertEqual(len(baseline), 1)
        self.assertAlmostEqual(baseline[0]["log_closure_amplitude"],
                               gained[0]["log_closure_amplitude"], places=12)
        self.assertAlmostEqual(baseline[0]["log_closure_amplitude"], math.log(3*2.5/(2*1.5)))

    def test_uncertainty_and_missing_quad(self):
        self.assertAlmostEqual(closure_amplitudes(fixture())[0]["thermal_sigma_log"], 2 / 30)
        self.assertEqual(closure_amplitudes(fixture()[:3]), [])


class SamplingTests(unittest.TestCase):
    def test_rotation_invariance_and_hermitian_duplication(self):
        rows = fixture()
        original = uv_sampling_moments(rows)
        rotated = [Visibility(r.utc_hour, r.station1, r.station2, -r.v_lambda, r.u_lambda,
                              r.amplitude_jy, r.phase_deg, r.sigma_jy) for r in rows]
        copied = [Visibility(r.utc_hour, r.station2, r.station1, -r.u_lambda, -r.v_lambda,
                             r.amplitude_jy, -r.phase_deg, r.sigma_jy) for r in rows]
        self.assertAlmostEqual(uv_sampling_moments(rotated)["uv_axis_ratio"],
                               original["uv_axis_ratio"])
        self.assertAlmostEqual(uv_sampling_moments(rows + copied)["uv_axis_ratio"],
                               original["uv_axis_ratio"])

    def test_leave_one_hour_out(self):
        rows = fixture(time=1.0) + fixture(time=2.0)
        checks = leave_one_hour_out_uv(rows)
        self.assertEqual(len(checks), 2)
        self.assertEqual([r["retained"] for r in checks], [6, 6])
        with self.assertRaises(ValueError):
            leave_one_hour_out_uv(fixture())

    def test_rank_deficient_sampling(self):
        rows = [Visibility(1, "A", "B", 1e9, 0, 1, 0, .1)]
        result = uv_sampling_moments(rows)
        self.assertTrue(math.isinf(result["uv_axis_ratio"]))
        self.assertTrue(math.isinf(result["angular_scale_proxy_uas"][1]))

    def test_eht_csv_reader(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "sample.csv"
            path.write_text("#SRC:M87\n#time(UTC),T1,T2,U(lambda),V(lambda),Iamp(Jy),Iphase(d),Isigma(Jy)\n"
                            "00.76805556,AA,LM,1081709696,-3833722368,0.01429205,-118.9454,0.00584681\n")
            rows = read_visibilities(path)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0].station1, "AA")
        self.assertAlmostEqual(rows[0].utc_hour, 0.76805556)


if __name__ == "__main__":
    unittest.main()
