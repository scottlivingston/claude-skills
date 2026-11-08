# Base image build from Ubuntu's signed root tarball

Status: open
Labels: impl
Blocked by: 01

## What to build

`dm image build` fetches Ubuntu's signed root tarball, verifies it, streams it into a raw disk image with the guest agent installed, and marks it read-only. `dm create` clones from it.

## Acceptance criteria

- [ ] `dm image build` produces an image `dm create` can clone, verified against Ubuntu's signature.
- [ ] A tampered tarball is refused.
