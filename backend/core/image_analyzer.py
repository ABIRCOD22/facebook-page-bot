import io
import logging

import aiohttp
from PIL import Image

from core.ai_engine import _generation_config, get_genai_aio_client
from config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class ImageAnalyzer:
    """Analyzes images sent by customers (Gemini Vision, free)."""

    def __init__(self):
        self.model = settings.GEMINI_MODEL

    async def analyze_image(self, image_url: str) -> str:
        """Download image from Facebook CDN and return a text description."""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    image_url, timeout=aiohttp.ClientTimeout(total=15)
                ) as resp:
                    if resp.status != 200:
                        logger.error("Failed to download image: %s", resp.status)
                        return "Customer sent an image (could not be loaded)"
                    image_bytes = await resp.read()

            if len(image_bytes) > 10 * 1024 * 1024:  # 10MB limit
                return "Customer sent a very large image (not processed)"

            image = Image.open(io.BytesIO(image_bytes))

            max_size = 1024
            if max(image.size) > max_size:
                ratio = max_size / max(image.size)
                new_size = (int(image.size[0] * ratio), int(image.size[1] * ratio))
                image = image.resize(new_size, Image.Resampling.LANCZOS)

            response = await get_genai_aio_client().models.generate_content(
                model=self.model,
                contents=[
                    "Analyze this image sent by a customer in a business chat. Describe: "
                    "1. What product/item is shown (if any) "
                    "2. Any visible text, prices, or labels "
                    "3. Colors, sizes, condition visible "
                    "4. If it's a screenshot: what webpage/app is shown, any product details visible "
                    "5. If it's an order/tracking screenshot: any order numbers, status, dates "
                    "6. Any other relevant details for customer service "
                    "Be concise, factual, and specific. Only describe what you actually see. "
                    "Format as a brief paragraph.",
                    image,
                ],
                config=_generation_config(),
            )

            analysis = response.text.strip()
            logger.info("Image analyzed: %s...", analysis[:100])
            return analysis
        except Exception as e:
            logger.error("Image analysis error: %s", e)
            return "Customer sent an image (analysis temporarily unavailable)"
