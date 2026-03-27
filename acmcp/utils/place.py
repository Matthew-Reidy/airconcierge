
import os
from google.maps import places_v1
from dotenv import load_dotenv

load_dotenv()

if not os.getenv("G_PLACES_KEY"):
    raise RuntimeError("No Place API key")

API_KEY = os.getenv("G_PLACES_KEY")

CLIENT = places_v1.PlacesAsyncClient()


async def discoverHotels(self, searchQuery: str):
    
    request = places_v1.SearchTextRequest(text_query=searchQuery)

    response = await CLIENT.search_text(request=request)

    return response

async def discoverAttractions(self, lat: int, long: int, searchQuery: str ):
    pass

async def placeDetails(self, placeID):

    request = places_v1.GetPlaceRequest()

    response = await CLIENT.get_place(request=request)

    return response

