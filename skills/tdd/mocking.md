# When to Mock

Mock at **system boundaries** only:

- External APIs (payment, email, etc.)
- Databases (sometimes - prefer test DB)
- Time/randomness
- File system (sometimes)

Don't mock:

- Your own classes/modules
- Internal collaborators
- Anything you control

For the shape of an interface at a boundary — dependencies passed in, one function per external operation rather than a generic fetcher — see `/codebase-design`.
