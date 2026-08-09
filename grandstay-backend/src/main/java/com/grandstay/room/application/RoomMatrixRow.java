package com.grandstay.room.application;

import java.util.UUID;

public interface RoomMatrixRow {
    UUID getRoomId();
    String getRoomNumber();
    UUID getFloorId();
    String getFloorName();
    Integer getFloorNumber();
    UUID getRoomTypeId();
    String getRoomTypeName();
    String getDisplayStatus();
    UUID getBookingId();
}
