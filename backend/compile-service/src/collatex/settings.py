import os

REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
TESTING = os.getenv('COLLATEX_TESTING', '0') == '1'
