# GPU-on VMs through Venus

Status: open
Labels: impl
Blocked by: 01, risks/01

## What to build

`dm create --gpu` gives the VM a virtio-gpu device with Venus; the helper starts the render server for it. A VM without `--gpu` gets no GPU device.

## Acceptance criteria

- [ ] In a `--gpu` VM, `vulkaninfo` reports the Venus device.
- [ ] Accretion's GPU tests pass in a `--gpu` VM.
