import os
from google.maps import places_v1
from google.type import latlng_pb2
from google.api_core.client_options import ClientOptions
from dotenv import load_dotenv

load_dotenv()

if not os.getenv("G_PLACES_KEY"):
    raise RuntimeError("No Place API key")

API_KEY = os.getenv("G_PLACES_KEY")

CLIENT = places_v1.PlacesAsyncClient(
    client_options=ClientOptions(api_key=API_KEY)
)

#100 miles in meters
DEFAULT_RADIUS = 160934


async def discoverPlaces(searchQuery: str, fineGrained: bool, lat: float | None, lng: float | None):
    
    request = None

    minRating = 3.5

    pricelevels = [
                    places_v1.PriceLevel.PRICE_LEVEL_FREE,
                    places_v1.PriceLevel.PRICE_LEVEL_INEXPENSIVE,
                    places_v1.PriceLevel.PRICE_LEVEL_MODERATE,
                  ]

    if fineGrained:

        center_point = latlng_pb2.LatLng(latitude=lat, longitude=lng)

        circle = places_v1.Circle(
            center=center_point,
            radius=DEFAULT_RADIUS
        )

        request = places_v1.SearchTextRequest(text_query=searchQuery, 
                                              location_bias=circle,
                                              price_levels=pricelevels,
                                              min_rating=minRating
                                              )

    else:
        request = places_v1.SearchTextRequest(text_query=searchQuery,
                                              price_levels=pricelevels,
                                              min_rating=minRating
                                              )

    fieldMask = "places.formattedAddress,places.displayName"    

    response = await CLIENT.search_text(request=request, metadata=[("x-goog-fieldmask",fieldMask)])

    return response


async def discoverPlacesNearby(lat: float, lng: float, includedTypes: list[str] | None):
    
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

    response = await CLIENT.search_nearby(request=request, metadata=[("x-goog-fieldmask",fieldMask)])

    return response

    
async def placeDetails(placeID: str):

    request = places_v1.GetPlaceRequest(
        name=f"places/{placeID}"
    )

    fieldMask = "places.formattedAddress,places.displayName"

    response = await CLIENT.get_place(request=request, metadata=[("x-goog-fieldmask",fieldMask)])

    return response

