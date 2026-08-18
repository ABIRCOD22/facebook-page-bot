"""Password hashing using stdlib hashlib.pbkdf2_hmac — zero deps, secure."""

import hashlib
import os
import secrets


def hash_password(plain: str) -> str:
    """Hash password with PBKDF2-SHA256. Returns 'pbkdf2:sha256:600000:$salt:$hash'."""
    salt = secrets.token_bytes(16)
    dk = hashlib.pbkdf2_hmac("sha256", plain.encode(), salt, 600_000)
    return f"pbkdf2:sha256:600000:{salt.hex()}:{dk.hex()}"


def verify_password(plain: str, stored: str) -> bool:
    """Verify password against stored hash."""
    try:
        _, _, iterations_hex, salt_hex, hash_hex = stored.split(":")
        iterations = int(iterations_hex)
        salt = bytes.fromhex(salt_hex)
        expected = bytes.fromhex(hash_hex)
        dk = hashlib.pbkdf2_hmac("sha256", plain.encode(), salt, iterations)
        return secrets.compare_digest(dk, expected)
    except (ValueError, AttributeError):
        return False
