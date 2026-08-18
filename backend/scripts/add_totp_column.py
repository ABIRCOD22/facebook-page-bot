"""One-off migration: add totp_secret to existing users table (create_all can't ALTER)."""

import asyncio
from sqlalchemy import text
from database.connection import engine


async def main():
    async with engine.begin() as conn:
        res = await conn.execute(
            text("SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name='totp_secret'")
        )
        if res.fetchone() is None:
            await conn.execute(text("ALTER TABLE users ADD COLUMN totp_secret VARCHAR(64)"))
            print("added column users.totp_secret")
        else:
            print("users.totp_secret already present")


asyncio.run(main())
