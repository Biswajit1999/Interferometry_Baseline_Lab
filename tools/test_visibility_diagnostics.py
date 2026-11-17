import cmath
import math
import unittest
from visibility_diagnostics import closure_phase_deg,closure_phase_sigma_deg,radial_uv_coverage,hermitian_residual

class TestVisibility(unittest.TestCase):
    def test_station_phase_cancels(self):
        p=[0.3,-0.7,1.1]; self.assertAlmostEqual(closure_phase_deg(cmath.exp(1j*(p[0]-p[1])),cmath.exp(1j*(p[1]-p[2])),cmath.exp(1j*(p[2]-p[0]))),0)
    def test_sigma(self): self.assertAlmostEqual(closure_phase_sigma_deg([10]*3,[1]*3),math.degrees(math.sqrt(0.03)))
    def test_uv(self): self.assertEqual(radial_uv_coverage([0,3,10],[0,4,0],[0,5,10])['counts'],[1,1])
    def test_hermitian(self): self.assertEqual(hermitian_residual(1+2j,1-2j),0)
    def test_invalid(self):
        with self.assertRaises(ValueError): closure_phase_deg(0j,1+0j,1+0j)

if __name__=='__main__': unittest.main()
