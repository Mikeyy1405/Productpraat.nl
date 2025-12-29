"""
Tool Definitions for Agent
OpenAI function calling format, compatible with Claude
Extended with Affiliate Shop Tools
"""

# ============================================================================
# CORE TOOLS (Sandbox Execution)
# ============================================================================

CORE_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "execute_python",
            "description": """Execute Python code in the sandbox. Use this for:
- Data processing and analysis
- Web scraping with requests/beautifulsoup
- File operations
- Mathematical calculations
- API calls
- Any complex logic

The sandbox has Python 3.11 with common libraries: requests, beautifulsoup4, pandas, numpy, matplotlib, etc.
Import libraries as needed. Code will be executed in /workspace directory.""",
            "parameters": {
                "type": "object",
                "properties": {
                    "code": {
                        "type": "string",
                        "description": "Python code to execute. Can be multi-line."
                    }
                },
                "required": ["code"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "shell_command",
            "description": """Execute a shell command in the sandbox. Use for:
- File system operations (ls, mkdir, mv, etc.)
- Installing packages (pip install, apt-get)
- Running system utilities (curl, wget, grep)
- Git operations

The sandbox is Ubuntu Linux. You have sudo access. Use -y flag for non-interactive installs.""",
            "parameters": {
                "type": "object",
                "properties": {
                    "command": {
                        "type": "string",
                        "description": "Shell command to execute"
                    }
                },
                "required": ["command"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "browser_navigate",
            "description": """Control a headless browser (Chromium via Playwright). Use for:
- Navigating to websites
- Extracting text content
- Taking screenshots
- Clicking elements
- Filling forms
- Scraping dynamic content (JavaScript-rendered pages)

The browser maintains session state across calls.""",
            "parameters": {
                "type": "object",
                "properties": {
                    "url": {
                        "type": "string",
                        "description": "URL to navigate to"
                    },
                    "action": {
                        "type": "string",
                        "enum": ["navigate", "get_text", "screenshot", "click", "fill_form", "extract_links"],
                        "description": "Action to perform"
                    },
                    "selector": {
                        "type": "string",
                        "description": "CSS selector for click/fill actions (optional)"
                    },
                    "value": {
                        "type": "string",
                        "description": "Value to fill in form (optional)"
                    }
                },
                "required": ["url", "action"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "web_search",
            "description": """Search the web using DuckDuckGo. Returns top search results with titles, URLs, and descriptions.
Use this to find current information, research topics, discover websites, etc.""",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Search query"
                    },
                    "num_results": {
                        "type": "integer",
                        "description": "Number of results to return (default: 5)",
                        "default": 5
                    }
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "save_file",
            "description": """Save content to a file in the workspace. Use for:
- Saving scraped data
- Creating reports
- Storing intermediate results
- Writing code/scripts

Files are persistent for the duration of the task.""",
            "parameters": {
                "type": "object",
                "properties": {
                    "filename": {
                        "type": "string",
                        "description": "Filename to save (e.g., 'report.md', 'data.json')"
                    },
                    "content": {
                        "type": "string",
                        "description": "Content to write to file"
                    }
                },
                "required": ["filename", "content"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "read_file",
            "description": """Read content from a file in the workspace. Use to:
- Check previously saved data
- Read intermediate results
- Load configuration

Returns file content as string.""",
            "parameters": {
                "type": "object",
                "properties": {
                    "filename": {
                        "type": "string",
                        "description": "Filename to read"
                    }
                },
                "required": ["filename"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "complete",
            "description": """Mark the task as complete. Use when:
- All steps in the plan are finished
- The deliverable is ready
- No more actions are needed

Include a summary of what was accomplished.""",
            "parameters": {
                "type": "object",
                "properties": {
                    "summary": {
                        "type": "string",
                        "description": "Summary of task completion and results"
                    },
                    "output_files": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "List of output files created"
                    }
                },
                "required": ["summary"]
            }
        }
    }
]

# ============================================================================
# AFFILIATE SHOP TOOLS (Bol.com Integration)
# ============================================================================

AFFILIATE_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "search_products",
            "description": """Search for products on Bol.com. Returns product list with:
- Title, description, EAN
- Current price and original price
- Rating (1-5 stars)
- Product image URL
- Pre-generated affiliate tracking link

Use this to find products for reviews, comparisons, and recommendations.""",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Search query (e.g., 'beste shampoo droog haar', 'koptelefoon bluetooth')"
                    },
                    "category": {
                        "type": "string",
                        "description": "Optional product category filter"
                    },
                    "max_results": {
                        "type": "integer",
                        "description": "Maximum number of results (default: 10, max: 20)",
                        "default": 10
                    }
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_product_details",
            "description": """Get detailed information for a specific product by EAN code.
Returns full specifications, description, pricing, ratings, and affiliate link.
Use after search_products to get more details on specific items.""",
            "parameters": {
                "type": "object",
                "properties": {
                    "ean": {
                        "type": "string",
                        "description": "Product EAN code (13-digit barcode number)"
                    }
                },
                "required": ["ean"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "generate_affiliate_link",
            "description": """Generate a tracked affiliate link for a Bol.com product URL.
The link includes tracking parameters for commission attribution.""",
            "parameters": {
                "type": "object",
                "properties": {
                    "product_url": {
                        "type": "string",
                        "description": "Original Bol.com product URL"
                    },
                    "product_name": {
                        "type": "string",
                        "description": "Product name for tracking (optional)"
                    }
                },
                "required": ["product_url"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "analyze_competition",
            "description": """Analyze competitor products for a search query.
Returns market analysis including:
- Price range (min, max, average)
- Rating distribution
- Top 3 competing products

Use this to understand market positioning before creating content.""",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Product search query to analyze"
                    },
                    "num_competitors": {
                        "type": "integer",
                        "description": "Number of competitors to analyze (default: 5)",
                        "default": 5
                    }
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_niche_suggestions",
            "description": """Get suggested product keywords for a niche.
Returns list of popular search terms for the specified niche category.
Available niches: beauty, tech, home, sport, baby""",
            "parameters": {
                "type": "object",
                "properties": {
                    "niche": {
                        "type": "string",
                        "enum": ["beauty", "tech", "home", "sport", "baby"],
                        "description": "Niche category"
                    }
                },
                "required": ["niche"]
            }
        }
    }
]

# ============================================================================
# CONTENT GENERATION TOOLS
# ============================================================================

CONTENT_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "generate_review_outline",
            "description": """Generate a structured outline for a product review article.
Returns sections with placeholders for:
- Introduction
- Product comparisons
- Buying guide
- FAQ
- Conclusion with affiliate CTAs""",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {
                        "type": "string",
                        "description": "Article title"
                    },
                    "products": {
                        "type": "array",
                        "items": {"type": "object"},
                        "description": "List of products to review (from search_products)"
                    },
                    "template": {
                        "type": "string",
                        "enum": ["product_review", "product_comparison", "best_of"],
                        "description": "Content template type"
                    }
                },
                "required": ["title", "products"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "generate_seo_meta",
            "description": """Generate SEO metadata for an article.
Returns optimized meta title, description, and keywords for search engines.""",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {
                        "type": "string",
                        "description": "Article title"
                    },
                    "content_summary": {
                        "type": "string",
                        "description": "Brief summary of article content"
                    },
                    "target_keywords": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Target keywords for SEO"
                    }
                },
                "required": ["title", "content_summary"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "format_product_card",
            "description": """Format a product as an HTML card for embedding in articles.
Includes image, title, price, rating, pros/cons, and affiliate CTA button.""",
            "parameters": {
                "type": "object",
                "properties": {
                    "product": {
                        "type": "object",
                        "description": "Product data (from search_products or get_product_details)"
                    },
                    "rank": {
                        "type": "integer",
                        "description": "Product ranking number (e.g., #1, #2)"
                    },
                    "pros": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "List of product advantages"
                    },
                    "cons": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "List of product disadvantages"
                    }
                },
                "required": ["product"]
            }
        }
    }
]

# ============================================================================
# PRODUCTPRAAT INTEGRATION TOOLS
# ============================================================================

PRODUCTPRAAT_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "save_to_productpraat",
            "description": """Save generated content to ProductPraat.nl platform.
Stores the article in the project's content library for review and publishing.""",
            "parameters": {
                "type": "object",
                "properties": {
                    "project_id": {
                        "type": "string",
                        "description": "ProductPraat project ID"
                    },
                    "title": {
                        "type": "string",
                        "description": "Article title"
                    },
                    "content": {
                        "type": "string",
                        "description": "Full article content (HTML or Markdown)"
                    },
                    "content_type": {
                        "type": "string",
                        "enum": ["article", "review", "comparison", "guide"],
                        "description": "Type of content"
                    }
                },
                "required": ["project_id", "title", "content"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "schedule_content",
            "description": """Schedule content for future generation or publishing.
Adds topics to the content calendar for automated processing.""",
            "parameters": {
                "type": "object",
                "properties": {
                    "project_id": {
                        "type": "string",
                        "description": "ProductPraat project ID"
                    },
                    "topics": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "query": {"type": "string"},
                                "category": {"type": "string"}
                            }
                        },
                        "description": "List of topics to schedule"
                    },
                    "start_date": {
                        "type": "string",
                        "description": "Start date (ISO format)"
                    },
                    "interval_days": {
                        "type": "integer",
                        "description": "Days between each article (default: 1)"
                    }
                },
                "required": ["project_id", "topics", "start_date"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_affiliate_stats",
            "description": """Get affiliate performance statistics.
Returns click counts, conversion rates, and revenue data for the project.""",
            "parameters": {
                "type": "object",
                "properties": {
                    "project_id": {
                        "type": "string",
                        "description": "ProductPraat project ID"
                    },
                    "period": {
                        "type": "string",
                        "enum": ["today", "week", "month", "all"],
                        "description": "Time period for stats (default: month)"
                    }
                },
                "required": ["project_id"]
            }
        }
    }
]

# ============================================================================
# COMBINED TOOLS LIST
# ============================================================================

# Default tools (core + affiliate)
TOOLS = CORE_TOOLS + AFFILIATE_TOOLS

# Full tools list (all capabilities)
ALL_TOOLS = CORE_TOOLS + AFFILIATE_TOOLS + CONTENT_TOOLS + PRODUCTPRAAT_TOOLS

# Tool categories for selective loading
TOOL_CATEGORIES = {
    'core': CORE_TOOLS,
    'affiliate': AFFILIATE_TOOLS,
    'content': CONTENT_TOOLS,
    'productpraat': PRODUCTPRAAT_TOOLS,
    'all': ALL_TOOLS
}


def get_tools(categories: list = None) -> list:
    """Get tools by category names."""
    if not categories:
        return TOOLS

    tools = []
    for cat in categories:
        if cat in TOOL_CATEGORIES:
            tools.extend(TOOL_CATEGORIES[cat])
    return tools
