"""
Affiliate Shop Tools for VPS Agent
Provides Bol.com integration, product management, and content generation capabilities
"""

import os
import json
import logging
import aiohttp
import base64
from typing import Dict, List, Optional, Any
from datetime import datetime

logger = logging.getLogger(__name__)

# ============================================================================
# BOL.COM API CLIENT
# ============================================================================

class BolComClient:
    """Bol.com Marketing API Client for product search and affiliate links."""

    def __init__(self, client_id: str = None, client_secret: str = None, site_code: str = None):
        self.client_id = client_id or os.getenv('BOL_CLIENT_ID')
        self.client_secret = client_secret or os.getenv('BOL_CLIENT_SECRET')
        self.site_code = site_code or os.getenv('BOL_SITE_CODE', '')
        self.base_url = 'https://api.bol.com/marketing/catalog/v1'
        self.auth_url = 'https://login.bol.com/token'
        self._token = None
        self._token_expires = 0

    async def _get_token(self) -> str:
        """Get OAuth2 access token."""
        if self._token and datetime.now().timestamp() < self._token_expires - 30:
            return self._token

        credentials = base64.b64encode(
            f"{self.client_id}:{self.client_secret}".encode()
        ).decode()

        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{self.auth_url}?grant_type=client_credentials",
                headers={
                    'Authorization': f'Basic {credentials}',
                    'Accept': 'application/json'
                }
            ) as resp:
                if resp.status != 200:
                    raise Exception(f"Bol.com auth failed: {resp.status}")
                data = await resp.json()
                self._token = data['access_token']
                self._token_expires = datetime.now().timestamp() + data['expires_in']
                return self._token

    async def search_products(
        self,
        query: str,
        page: int = 1,
        page_size: int = 10,
        country: str = 'NL'
    ) -> Dict[str, Any]:
        """Search for products on Bol.com."""
        token = await self._get_token()

        params = {
            'search-term': query,
            'page': str(page),
            'page-size': str(page_size),
            'country-code': country,
            'include-image': 'true',
            'include-offer': 'true',
            'include-rating': 'true'
        }

        async with aiohttp.ClientSession() as session:
            async with session.get(
                f"{self.base_url}/products/search",
                params=params,
                headers={
                    'Authorization': f'Bearer {token}',
                    'Accept': 'application/json',
                    'Accept-Language': 'nl'
                }
            ) as resp:
                if resp.status != 200:
                    error = await resp.text()
                    raise Exception(f"Bol.com API error: {resp.status} - {error}")
                return await resp.json()

    async def get_product(self, ean: str, country: str = 'NL') -> Dict[str, Any]:
        """Get product details by EAN."""
        token = await self._get_token()

        params = {
            'country-code': country,
            'include-specifications': 'true',
            'include-image': 'true',
            'include-offer': 'true',
            'include-rating': 'true'
        }

        async with aiohttp.ClientSession() as session:
            async with session.get(
                f"{self.base_url}/products/{ean}",
                params=params,
                headers={
                    'Authorization': f'Bearer {token}',
                    'Accept': 'application/json'
                }
            ) as resp:
                if resp.status != 200:
                    return None
                return await resp.json()

    def generate_affiliate_link(self, product_url: str, product_name: str = '') -> str:
        """Generate tracked affiliate link."""
        from urllib.parse import quote
        encoded_url = quote(product_url, safe='')
        encoded_name = quote(product_name or 'Product', safe='')
        return f"https://partner.bol.com/click/click?p=2&t=url&s={self.site_code}&f=TXL&url={encoded_url}&name={encoded_name}"


# ============================================================================
# PRODUCTPRAAT API CLIENT
# ============================================================================

class ProductPraatClient:
    """Client for ProductPraat.nl API integration."""

    def __init__(self, api_url: str = None, api_key: str = None):
        self.api_url = api_url or os.getenv('PRODUCTPRAAT_API_URL', 'https://productpraat.nl')
        self.api_key = api_key or os.getenv('PRODUCTPRAAT_API_KEY')

    async def get_project_config(self, project_id: str) -> Dict[str, Any]:
        """Get project configuration including affiliate settings."""
        async with aiohttp.ClientSession() as session:
            async with session.get(
                f"{self.api_url}/api/project/config",
                params={'projectId': project_id},
                headers={'Authorization': f'Bearer {self.api_key}'}
            ) as resp:
                if resp.status == 200:
                    return await resp.json()
                return {}

    async def save_article(
        self,
        project_id: str,
        title: str,
        content: str,
        meta: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """Save generated article to ProductPraat."""
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{self.api_url}/api/articles/create",
                json={
                    'projectId': project_id,
                    'title': title,
                    'content': content,
                    'metadata': meta or {}
                },
                headers={
                    'Authorization': f'Bearer {self.api_key}',
                    'Content-Type': 'application/json'
                }
            ) as resp:
                return await resp.json()

    async def track_click(
        self,
        project_id: str,
        product_ean: str,
        article_id: str = None
    ) -> bool:
        """Record affiliate click."""
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{self.api_url}/api/affiliate/click",
                json={
                    'projectId': project_id,
                    'productEan': product_ean,
                    'articleId': article_id
                },
                headers={'Authorization': f'Bearer {self.api_key}'}
            ) as resp:
                return resp.status == 200

    async def get_affiliate_stats(self, project_id: str) -> Dict[str, Any]:
        """Get affiliate performance statistics."""
        async with aiohttp.ClientSession() as session:
            async with session.get(
                f"{self.api_url}/api/affiliate/stats",
                params={'projectId': project_id},
                headers={'Authorization': f'Bearer {self.api_key}'}
            ) as resp:
                if resp.status == 200:
                    return await resp.json()
                return {}

    async def schedule_article(
        self,
        project_id: str,
        search_query: str,
        product_category: str,
        scheduled_for: str
    ) -> Dict[str, Any]:
        """Schedule article for generation."""
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{self.api_url}/api/affiliate/batch-generate",
                json={
                    'projectId': project_id,
                    'articles': [{
                        'searchQuery': search_query,
                        'productCategory': product_category
                    }],
                    'schedule': True,
                    'startDate': scheduled_for
                },
                headers={
                    'Authorization': f'Bearer {self.api_key}',
                    'Content-Type': 'application/json'
                }
            ) as resp:
                return await resp.json()


# ============================================================================
# AFFILIATE TOOLS CLASS (for Agent integration)
# ============================================================================

class AffiliateTools:
    """
    Collection of affiliate marketing tools for the VPS agent.
    Integrates with Bol.com, ProductPraat.nl, and provides content generation capabilities.
    """

    def __init__(self):
        self.bol_client = BolComClient()
        self.productpraat_client = ProductPraatClient()

    async def search_products(
        self,
        query: str,
        category: str = None,
        max_results: int = 10
    ) -> Dict[str, Any]:
        """
        Search for products on Bol.com.
        Returns product list with prices, ratings, and affiliate links.
        """
        try:
            result = await self.bol_client.search_products(query, page_size=max_results)

            products = []
            for item in result.get('results', [])[:max_results]:
                product = {
                    'ean': item.get('ean'),
                    'title': item.get('title'),
                    'description': item.get('description', ''),
                    'price': item.get('offer', {}).get('price'),
                    'original_price': item.get('offer', {}).get('strikethroughPrice'),
                    'rating': item.get('rating'),
                    'image_url': item.get('image', {}).get('url'),
                    'product_url': item.get('url'),
                    'delivery': item.get('offer', {}).get('deliveryDescription'),
                    'affiliate_link': self.bol_client.generate_affiliate_link(
                        item.get('url', ''),
                        item.get('title', '')
                    )
                }
                products.append(product)

            return {
                'success': True,
                'query': query,
                'total_results': result.get('totalResults', 0),
                'products': products
            }
        except Exception as e:
            logger.error(f"Product search error: {e}")
            return {'success': False, 'error': str(e), 'products': []}

    async def get_product_details(self, ean: str) -> Dict[str, Any]:
        """Get detailed product information by EAN."""
        try:
            product = await self.bol_client.get_product(ean)
            if not product:
                return {'success': False, 'error': 'Product not found'}

            return {
                'success': True,
                'product': {
                    'ean': product.get('ean'),
                    'title': product.get('title'),
                    'description': product.get('description'),
                    'price': product.get('offer', {}).get('price'),
                    'rating': product.get('rating'),
                    'specifications': product.get('specificationGroups', []),
                    'affiliate_link': self.bol_client.generate_affiliate_link(
                        product.get('url', ''),
                        product.get('title', '')
                    )
                }
            }
        except Exception as e:
            logger.error(f"Product details error: {e}")
            return {'success': False, 'error': str(e)}

    async def generate_product_review(
        self,
        product: Dict[str, Any],
        style: str = 'detailed'
    ) -> Dict[str, Any]:
        """
        Generate product review content.
        This is a template - actual generation uses LLM via the agent.
        """
        template = f"""
## {product.get('title', 'Product Review')}

**Prijs:** €{product.get('price', 'N/A')}
**Rating:** {'⭐' * int(product.get('rating', 0))} ({product.get('rating', 'N/A')}/5)

### Productomschrijving
{product.get('description', 'Geen beschrijving beschikbaar.')}

### Specificaties
{self._format_specifications(product.get('specifications', []))}

### Conclusie
[Hier komt de AI-gegenereerde conclusie]

[Bekijk op Bol.com]({product.get('affiliate_link', '#')})

---
*Dit artikel bevat affiliate links. Bij aankoop via deze links ontvangen wij een kleine commissie.*
"""
        return {
            'success': True,
            'content': template,
            'product_ean': product.get('ean')
        }

    def _format_specifications(self, specs: List[Dict]) -> str:
        """Format product specifications as markdown."""
        if not specs:
            return "Geen specificaties beschikbaar."

        lines = []
        for group in specs:
            lines.append(f"**{group.get('title', 'Algemeen')}**")
            for spec in group.get('specifications', []):
                values = ', '.join(spec.get('values', []))
                lines.append(f"- {spec.get('name', '')}: {values}")
        return '\n'.join(lines)

    async def analyze_competition(
        self,
        query: str,
        num_competitors: int = 5
    ) -> Dict[str, Any]:
        """
        Analyze competitor products for a search query.
        Returns pricing, rating, and positioning data.
        """
        try:
            result = await self.bol_client.search_products(query, page_size=num_competitors)
            products = result.get('results', [])

            if not products:
                return {'success': False, 'error': 'No products found'}

            prices = [p.get('offer', {}).get('price', 0) for p in products if p.get('offer')]
            ratings = [p.get('rating', 0) for p in products if p.get('rating')]

            analysis = {
                'success': True,
                'query': query,
                'num_products': len(products),
                'price_analysis': {
                    'min': min(prices) if prices else 0,
                    'max': max(prices) if prices else 0,
                    'avg': sum(prices) / len(prices) if prices else 0
                },
                'rating_analysis': {
                    'min': min(ratings) if ratings else 0,
                    'max': max(ratings) if ratings else 0,
                    'avg': sum(ratings) / len(ratings) if ratings else 0
                },
                'top_products': [
                    {
                        'title': p.get('title'),
                        'price': p.get('offer', {}).get('price'),
                        'rating': p.get('rating')
                    }
                    for p in products[:3]
                ]
            }

            return analysis
        except Exception as e:
            logger.error(f"Competition analysis error: {e}")
            return {'success': False, 'error': str(e)}

    async def get_affiliate_stats(self, project_id: str) -> Dict[str, Any]:
        """Get affiliate performance statistics for a project."""
        return await self.productpraat_client.get_affiliate_stats(project_id)

    async def save_content(
        self,
        project_id: str,
        title: str,
        content: str,
        content_type: str = 'article',
        metadata: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """Save generated content to ProductPraat.nl."""
        return await self.productpraat_client.save_article(
            project_id,
            title,
            content,
            {
                'content_type': content_type,
                'generated_by': 'vps_agent',
                'generated_at': datetime.now().isoformat(),
                **(metadata or {})
            }
        )

    async def schedule_content_batch(
        self,
        project_id: str,
        topics: List[Dict[str, str]],
        start_date: str,
        interval_days: int = 1
    ) -> Dict[str, Any]:
        """Schedule multiple articles for generation."""
        scheduled = []
        from datetime import datetime, timedelta

        base_date = datetime.fromisoformat(start_date.replace('Z', '+00:00'))

        for i, topic in enumerate(topics):
            scheduled_for = base_date + timedelta(days=i * interval_days)
            result = await self.productpraat_client.schedule_article(
                project_id,
                topic.get('query', ''),
                topic.get('category', ''),
                scheduled_for.isoformat()
            )
            scheduled.append({
                'topic': topic,
                'scheduled_for': scheduled_for.isoformat(),
                'result': result
            })

        return {
            'success': True,
            'scheduled_count': len(scheduled),
            'items': scheduled
        }


# ============================================================================
# CONTENT TEMPLATES
# ============================================================================

CONTENT_TEMPLATES = {
    'product_review': """
# {title}

*Laatst bijgewerkt: {date}*

{introduction}

## De Beste {category} van {year}

{product_list}

## Koopgids: Waar Moet Je Op Letten?

{buying_guide}

## Veelgestelde Vragen

{faq}

## Conclusie

{conclusion}

---
*Affiliate disclaimer: Dit artikel bevat affiliate links naar Bol.com. Bij aankoop via deze links ontvangen wij een kleine commissie zonder extra kosten voor jou.*
""",

    'product_comparison': """
# {title}

{introduction}

## Vergelijkingstabel

| Product | Prijs | Rating | Geschikt voor |
|---------|-------|--------|---------------|
{comparison_table}

## Gedetailleerde Vergelijking

{detailed_comparison}

## Onze Aanbeveling

{recommendation}
""",

    'best_of': """
# Top {num} Beste {category} van {year}

{introduction}

{ranked_products}

## Hoe We Testen

{methodology}

## Conclusie

{conclusion}
"""
}


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_niche_keywords(niche: str) -> List[str]:
    """Get suggested keywords for a niche."""
    niche_keywords = {
        'beauty': [
            'beste shampoo', 'gezichtscreme', 'mascara', 'parfum',
            'haardroger', 'straightener', 'nagellak', 'foundation'
        ],
        'tech': [
            'koptelefoon', 'powerbank', 'smartwatch', 'bluetooth speaker',
            'webcam', 'toetsenbord', 'muis', 'monitor'
        ],
        'home': [
            'stofzuiger', 'koffiemachine', 'airfryer', 'robotstofzuiger',
            'blender', 'waterkoker', 'broodrooster', 'magnetron'
        ],
        'sport': [
            'hardloopschoenen', 'fitness tracker', 'yogamat', 'dumbbells',
            'sporttas', 'fietshelm', 'tennisracket', 'voetbal'
        ],
        'baby': [
            'kinderwagen', 'babyfoon', 'autostoeltje', 'luiers',
            'flessenwarmer', 'babybed', 'buggy', 'draagzak'
        ]
    }
    return niche_keywords.get(niche.lower(), [])


def format_price(price: float, currency: str = 'EUR') -> str:
    """Format price for display."""
    if currency == 'EUR':
        return f"€{price:,.2f}".replace(',', '.')
    return f"{currency} {price:,.2f}"


def generate_slug(title: str) -> str:
    """Generate URL-friendly slug from title."""
    import re
    slug = title.lower()
    slug = re.sub(r'[^\w\s-]', '', slug)
    slug = re.sub(r'\s+', '-', slug)
    slug = re.sub(r'-+', '-', slug)
    return slug[:100]
