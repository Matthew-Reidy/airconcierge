import os
from google.maps import places_v1
from google.type import latlng_pb2
from google.api_core.client_options import ClientOptions
from dotenv import load_dotenv

load_dotenv()

if not os.getenv("G_PLACES_KEY"):
    raise RuntimeError("No Place API key")

API_KEY = os.getenv("G_PLACES_KEY")

#100 miles in meters
DEFAULT_RADIUS = 160934

_ASYNC_CLIENT = None

def get_client():
    global _ASYNC_CLIENT

    if _ASYNC_CLIENT is None:
        # This creates the client on the loop that is currently 
        # running the searchPlaces tool.
        _ASYNC_CLIENT = places_v1.PlacesAsyncClient(
                        client_options=ClientOptions(api_key=API_KEY)
                    )
        
    return _ASYNC_CLIENT

async def discoverPlaces(searchQuery: str, fineGrained: bool, lat: float | None, lng: float | None):

    client = get_client()

    request = None

    minRating = 1.0

    pricelevels = [
                    places_v1.PriceLevel.PRICE_LEVEL_INEXPENSIVE,
                    places_v1.PriceLevel.PRICE_LEVEL_MODERATE,
                    places_v1.PriceLevel.PRICE_LEVEL_EXPENSIVE,
                    places_v1.PriceLevel.PRICE_LEVEL_VERY_EXPENSIVE
                  ]

    if fineGrained:

        center_point = latlng_pb2.LatLng(latitude=lat, longitude=lng)

        circle = places_v1.Circle(
            center=center_point,
            radius=DEFAULT_RADIUS
        )

        request = places_v1.SearchTextRequest(text_query=searchQuery, 
                                              location_bias=circle,
                                            #   price_levels=pricelevels,
                                            #   min_rating=minRating
                                              )

    else:
        request = places_v1.SearchTextRequest(text_query=searchQuery,
                                            #   price_levels=pricelevels,
                                            #   min_rating=minRating
                                              )

    fieldMask = "places.formattedAddress,places.displayName"    

    response = await client.search_text(request=request, metadata=[("x-goog-fieldmask",fieldMask)])

    return response


async def discoverPlacesNearby(lat: float, lng: float, includedTypes: list[str] | None):
    
    client = get_client()
    # Create the LatLng object for the center
    center_point = latlng_pb2.LatLng(latitude=lat, longitude=lng)
    # Create the Circle object
    circle_area = places_v1.SearchNearbyRequest.LocationRestriction(
        center=center_point,
        radius=DEFAULT_RADIUS
    )

    request = places_v1.SearchNearbyRequest(
        location_restriction = circle_area,
        included_types=includedTypes
        )

    fieldMask = "places.formattedAddress,places.displayName"

    response = await client.search_nearby(request=request, metadata=[("x-goog-fieldmask",fieldMask)])

    return response

    
async def placeDetails(placeID: str):

    client = get_client()

    request = places_v1.GetPlaceRequest(
        name=f"places/{placeID}"
    )

    fieldMask = "places.formattedAddress,places.displayName"

    response = await client.get_place(request=request, metadata=[("x-goog-fieldmask",fieldMask)])

    return response

