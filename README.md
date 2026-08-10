# Interferometry Baseline Lab

An observation-led browser instrument for radio interferometric imaging. The console now starts
from calibrated Event Horizon Telescope (EHT) measurements of M87* released with the first EHT
results, rather than generating an invented array and source by default.

## Observational Product

The worker streams the official EHT Collaboration data product `2019-D01-01`: EHT-HOPS
network-calibrated, time-averaged Stokes-I visibilities of M87 from the April 2017 campaign.
The interface exposes all four released observation days and both released frequency bands.

| Selector | Official Released Files |
| --- | --- |
| April 05 / DOY 095 | `SR1_M87_2017_095_hi_hops_netcal_StokesI.csv`, `..._lo_...csv` |
| April 06 / DOY 096 | `SR1_M87_2017_096_hi_hops_netcal_StokesI.csv`, `..._lo_...csv` |
| April 10 / DOY 100 | `SR1_M87_2017_100_hi_hops_netcal_StokesI.csv`, `..._lo_...csv` |
| April 11 / DOY 101 | `SR1_M87_2017_101_hi_hops_netcal_StokesI.csv`, `..._lo_...csv` |

Official release: [EHT Collaboration / 2019-D01-01](https://github.com/eventhorizontelescope/2019-D01-01).

Each record supplies UTC sample time, station pair, released `u` and `v` coordinates in
wavelengths, Stokes-I amplitude in Jy, visibility phase in degrees and statistical uncertainty.
The worker converts measured polar visibility into complex components:

```text
Re(V) = |V| cos(phi)
Im(V) = |V| sin(phi)
```

It grids each released visibility with its Hermitian conjugate and produces:

```text
dirty beam  = IFFT2 { sampling weights }
dirty image = IFFT2 { weights x measured V(u,v) }
```

The `u-v` display, visibility-amplitude track, dirty beam and dirty image are therefore derived
from published EHT measurements. No simulated data silently replace a failed network request.

## Optional Ring Reference

The `MODEL REFERENCE` switch enables a separate asymmetric annular brightness model in the
fourth image panel. It is labelled as a model and does not modify the observed dirty image.
The diameter, width, asymmetry and position angle controls allow visual comparison with a
horizon-scale ring interpretation without implying deconvolution or fitted parameters.

The van Cittert-Zernike relationship underlying imaging is:

```text
V(u,v) = integral integral I(l,m) exp[-2 pi i (u l + v m)] dl dm
```

## Architecture

```text
index.html
assets/
  css/style.css                    Console layout
  js/app.js                        Canvas rendering and observation/model labelling
  js/physicsWorker.js              EHT CSV parsing, gridding and 2D IFFT
data/
  observations/
    eht_m87_2017_metadata.json     Release provenance manifest
    SR1_M87_2017_*.csv             optional unchanged official local cache
tools/
  fetch_eht_observations.py        Acquire and hash recorded visibility CSV files
  validate_observations.py         Validate retained release products
```

The worker first attempts locally retained official CSV files and falls back to the EHT
Collaboration public release when the local cache is absent. It caches the selected file for
the current session. Numerical operations remain in the worker so UI interaction remains
responsive.

## Run

Serve this directory over HTTP:

```bash
python -m http.server 8000
```

Open `http://localhost:8000/`. With no local cache, initial loading of each released EHT file
requires access to `raw.githubusercontent.com/eventhorizontelescope/2019-D01-01`.

For offline use, retrieve and validate the unchanged official CSV products:

```bash
python tools/fetch_eht_observations.py
python tools/validate_observations.py
```

## Export

`EXPORT UV` downloads the accumulated released records and calculated Cartesian visibility
components:

```text
utc_hours,baseline,u_wavelengths,v_wavelengths,stokes_i_amplitude_jy,
stokes_i_phase_deg,stokes_i_sigma_jy,visibility_real_jy,visibility_imaginary_jy
```

## Limits

This console performs direct natural-weight gridding and a dirty IFFT only. It does not perform
publication-grade EHT imaging, CLEAN/RML deconvolution, station-gain self-calibration, closure
quantity analysis, systematic-error modelling, scattering correction or time-variable source
inference.

## References

Event Horizon Telescope Collaboration, 2019. First M87 Event Horizon Telescope results. III.
Data processing and calibration. *The Astrophysical Journal Letters*, 875(1), L3.
https://doi.org/10.3847/2041-8213/ab0c57.

Event Horizon Telescope Collaboration, 2019. First M87 Event Horizon Telescope results. IV.
Imaging the central supermassive black hole. *The Astrophysical Journal Letters*, 875(1), L4.
https://doi.org/10.3847/2041-8213/ab0e85.

Thompson, A.R., Moran, J.M. and Swenson Jr, G.W., 2017. *Interferometry and synthesis in
radio astronomy*. 3rd ed. Cham: Springer Nature.
https://doi.org/10.1007/978-3-319-44431-4.

## Licence

Released under the MIT Licence. See `LICENSE`.
