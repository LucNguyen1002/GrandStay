package com.grandstay.room.application;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.grandstay.room.domain.Amenity;
import com.grandstay.room.domain.Floor;
import com.grandstay.room.domain.RatePlan;
import com.grandstay.room.domain.Room;
import com.grandstay.room.domain.RoomType;
import com.grandstay.room.domain.RoomTypeAmenity;
import com.grandstay.room.domain.RoomTypeAmenityId;
import com.grandstay.room.infrastructure.AmenityRepository;
import com.grandstay.room.infrastructure.FloorRepository;
import com.grandstay.room.infrastructure.RatePlanRepository;
import com.grandstay.room.infrastructure.RoomRepository;
import com.grandstay.room.infrastructure.RoomTypeAmenityRepository;
import com.grandstay.room.infrastructure.RoomTypeRepository;
import com.grandstay.service.domain.HotelService;
import com.grandstay.service.infrastructure.HotelServiceRepository;
import com.grandstay.shared.domain.ModelEnums.PricingUnit;
import com.grandstay.shared.domain.ModelEnums.RoomOperationalStatus;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Creates a practical starter catalog for an empty small or medium hotel.
 * The initializer deliberately skips partially configured databases so it
 * never merges assumptions into business data that an operator already owns.
 */
@Component
@ConditionalOnProperty(prefix = "grandstay.catalog.bootstrap", name = "enabled", havingValue = "true")
public class SmallHotelCatalogBootstrapInitializer implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(SmallHotelCatalogBootstrapInitializer.class);
    private static final String CURRENCY = "VND";
    private static final BigDecimal TAX_RATE = new BigDecimal("8.00");

    private static final List<FloorSeed> FLOOR_SEEDS = List.of(
            new FloorSeed("F1", "Tầng 1", 1, "Tầng lưu trú thuận tiện, phù hợp khách ngắn ngày và gia đình."),
            new FloorSeed("F2", "Tầng 2", 2, "Tầng lưu trú tiêu chuẩn, yên tĩnh và dễ vận hành."),
            new FloorSeed("F3", "Tầng 3", 3, "Tầng cao dành cho phòng Superior và Deluxe."));

    private static final List<RoomTypeSeed> ROOM_TYPE_SEEDS = List.of(
            new RoomTypeSeed("STD", "Standard", "Phòng tiêu chuẩn gọn gàng cho khách công tác hoặc cặp đôi.",
                    2, 0, "90000", "650000", "550000"),
            new RoomTypeSeed("SUP", "Superior", "Không gian rộng hơn, có bàn làm việc và phù hợp kỳ nghỉ linh hoạt.",
                    2, 1, "110000", "780000", "680000"),
            new RoomTypeSeed("DLX", "Deluxe", "Phòng cao cấp có khu thư giãn, ưu tiên tầm nhìn và sự riêng tư.",
                    2, 1, "140000", "980000", "850000"),
            new RoomTypeSeed("FAM", "Family", "Phòng gia đình cho nhóm nhỏ, tối ưu không gian và thời gian lưu trú dài.",
                    4, 2, "170000", "1200000", "1050000"));

    private static final List<AmenitySeed> AMENITY_SEEDS = List.of(
            new AmenitySeed("WIFI", "Wi-Fi tốc độ cao", "Kết nối Internet trong phòng.", "wifi"),
            new AmenitySeed("AC", "Điều hòa", "Điều hòa riêng cho từng phòng.", "snowflake"),
            new AmenitySeed("TV", "Smart TV", "TV thông minh phục vụ giải trí.", "tv"),
            new AmenitySeed("MINIBAR", "Minibar", "Tủ lạnh minibar trong phòng.", "refrigerator"),
            new AmenitySeed("KETTLE", "Ấm đun nước", "Ấm đun nước và trà cơ bản.", "coffee"),
            new AmenitySeed("HAIR_DRYER", "Máy sấy tóc", "Máy sấy tóc trong phòng tắm.", "wind"),
            new AmenitySeed("DESK", "Bàn làm việc", "Bàn và ghế làm việc riêng.", "briefcase-business"),
            new AmenitySeed("SAFE", "Két an toàn", "Két cá nhân cho tài sản có giá trị.", "lock-keyhole"),
            new AmenitySeed("BALCONY", "Ban công", "Ban công riêng thoáng sáng.", "panel-top-open"),
            new AmenitySeed("BATHTUB", "Bồn tắm", "Bồn tắm riêng trong phòng.", "bath"),
            new AmenitySeed("SOFA", "Khu sofa", "Khu vực ngồi nghỉ trong phòng.", "sofa"));

    private static final List<ServiceSeed> SERVICE_SEEDS = List.of(
            new ServiceSeed("BREAKFAST", "Bữa sáng", "FOOD", "Suất", "120000", "Bữa sáng tiêu chuẩn cho một khách."),
            new ServiceSeed("LAUNDRY", "Giặt ủi", "LAUNDRY", "Kg", "60000", "Giặt và sấy quần áo theo kilogram."),
            new ServiceSeed("AIRPORT_TRANSFER", "Đưa đón sân bay", "TRANSPORT", "Chuyến", "350000", "Xe đưa hoặc đón sân bay một chiều."),
            new ServiceSeed("EXTRA_BED", "Giường phụ", "ROOM", "Đêm", "250000", "Giường phụ kèm bộ chăn ga cho một đêm."),
            new ServiceSeed("MOTORBIKE", "Thuê xe máy", "TRANSPORT", "Ngày", "150000", "Thuê xe máy trong 24 giờ."),
            new ServiceSeed("MINERAL_WATER", "Nước suối minibar", "MINIBAR", "Chai", "20000", "Nước suối bổ sung ngoài định mức miễn phí."),
            new ServiceSeed("COFFEE", "Cà phê", "FOOD", "Ly", "45000", "Cà phê phục vụ tại phòng hoặc khu tiếp khách."));

    private final FloorRepository floors;
    private final RoomTypeRepository roomTypes;
    private final RoomRepository rooms;
    private final RatePlanRepository ratePlans;
    private final AmenityRepository amenities;
    private final RoomTypeAmenityRepository roomTypeAmenities;
    private final HotelServiceRepository services;

    public SmallHotelCatalogBootstrapInitializer(FloorRepository floors, RoomTypeRepository roomTypes,
            RoomRepository rooms, RatePlanRepository ratePlans, AmenityRepository amenities,
            RoomTypeAmenityRepository roomTypeAmenities, HotelServiceRepository services) {
        this.floors = floors;
        this.roomTypes = roomTypes;
        this.rooms = rooms;
        this.ratePlans = ratePlans;
        this.amenities = amenities;
        this.roomTypeAmenities = roomTypeAmenities;
        this.services = services;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (hasExistingCoreCatalog()) {
            log.info("Small-hotel catalog bootstrap skipped because core catalog data already exists");
            return;
        }

        Map<String, Floor> floorByCode = seedFloors();
        Map<String, RoomType> typeByCode = seedRoomTypes();
        seedRooms(floorByCode, typeByCode);
        seedRatePlans(typeByCode);
        seedAmenities(typeByCode);
        seedServices();

        log.info("Small-hotel catalog bootstrap completed: {} floors, {} room types, {} rooms, {} rate plans",
                FLOOR_SEEDS.size(), ROOM_TYPE_SEEDS.size(), rooms.count(), ratePlans.count());
    }

    private boolean hasExistingCoreCatalog() {
        return floors.count() > 0 || roomTypes.count() > 0 || rooms.count() > 0 || ratePlans.count() > 0;
    }

    private Map<String, Floor> seedFloors() {
        List<Floor> entities = FLOOR_SEEDS.stream().map(seed -> {
            Floor floor = new Floor();
            floor.setCode(seed.code());
            floor.setName(seed.name());
            floor.setFloorNumber(seed.number());
            floor.setDescription(seed.description());
            return floor;
        }).toList();
        Map<String, Floor> result = new LinkedHashMap<>();
        floors.saveAll(entities).forEach(floor -> result.put(floor.getCode(), floor));
        return result;
    }

    private Map<String, RoomType> seedRoomTypes() {
        List<RoomType> entities = ROOM_TYPE_SEEDS.stream().map(seed -> {
            RoomType type = new RoomType();
            type.setCode(seed.code());
            type.setName(seed.name());
            type.setDescription(seed.description());
            type.setCapacityAdults(seed.adults());
            type.setCapacityChildren(seed.children());
            type.setBaseHourlyRate(seed.hourly());
            type.setBaseDailyRate(seed.daily());
            type.setBaseNightlyRate(seed.nightly());
            type.setCurrency(CURRENCY);
            return type;
        }).toList();
        Map<String, RoomType> result = new LinkedHashMap<>();
        roomTypes.saveAll(entities).forEach(type -> result.put(type.getCode(), type));
        return result;
    }

    private void seedRooms(Map<String, Floor> floorByCode, Map<String, RoomType> typeByCode) {
        List<Room> entities = new ArrayList<>();
        addRooms(entities, floorByCode, typeByCode, "F1", "STD", 101, 102, 103, 104);
        addRooms(entities, floorByCode, typeByCode, "F1", "SUP", 105, 106, 107);
        addRooms(entities, floorByCode, typeByCode, "F1", "FAM", 108);
        addRooms(entities, floorByCode, typeByCode, "F2", "STD", 201, 202, 203, 204);
        addRooms(entities, floorByCode, typeByCode, "F2", "SUP", 205, 206, 207);
        addRooms(entities, floorByCode, typeByCode, "F2", "FAM", 208);
        addRooms(entities, floorByCode, typeByCode, "F3", "SUP", 301, 302);
        addRooms(entities, floorByCode, typeByCode, "F3", "DLX", 303, 304, 305, 306, 307, 308);
        rooms.saveAll(entities);
    }

    private void addRooms(List<Room> target, Map<String, Floor> floorByCode,
            Map<String, RoomType> typeByCode, String floorCode, String typeCode, int... numbers) {
        Arrays.stream(numbers).forEach(number -> {
            Room room = new Room();
            room.setRoomNumber(Integer.toString(number));
            room.setFloorId(floorByCode.get(floorCode).getId());
            room.setRoomTypeId(typeByCode.get(typeCode).getId());
            room.setOperationalStatus(RoomOperationalStatus.AVAILABLE);
            room.setNotes("Phòng khởi tạo theo mô hình khách sạn vừa và nhỏ.");
            target.add(room);
        });
    }

    private void seedRatePlans(Map<String, RoomType> typeByCode) {
        List<RatePlan> entities = new ArrayList<>();
        ROOM_TYPE_SEEDS.forEach(seed -> {
            entities.add(rate(typeByCode.get(seed.code()), seed.code() + "-HOUR", seed.name() + " - Theo giờ",
                    PricingUnit.HOURLY, seed.hourly()));
            entities.add(rate(typeByCode.get(seed.code()), seed.code() + "-DAY", seed.name() + " - Theo ngày",
                    PricingUnit.DAILY, seed.daily()));
            entities.add(rate(typeByCode.get(seed.code()), seed.code() + "-NIGHT", seed.name() + " - Theo đêm",
                    PricingUnit.NIGHTLY, seed.nightly()));
        });
        ratePlans.saveAll(entities);
    }

    private RatePlan rate(RoomType type, String code, String name, PricingUnit unit, BigDecimal amount) {
        RatePlan rate = new RatePlan();
        rate.setRoomTypeId(type.getId());
        rate.setCode(code);
        rate.setName(name);
        rate.setPricingUnit(unit);
        rate.setRate(amount);
        rate.setCurrency(CURRENCY);
        rate.setMinStayUnits(unit == PricingUnit.HOURLY ? 2 : 1);
        rate.setRefundable(true);
        rate.setActive(true);
        return rate;
    }

    private void seedAmenities(Map<String, RoomType> typeByCode) {
        Map<String, Amenity> amenityByCode = new LinkedHashMap<>();
        AMENITY_SEEDS.forEach(seed -> {
            Amenity amenity = amenities.findByCodeAndDeletedAtIsNull(seed.code()).orElseGet(() -> {
                Amenity created = new Amenity();
                created.setCode(seed.code());
                created.setName(seed.name());
                created.setDescription(seed.description());
                created.setIcon(seed.icon());
                return amenities.save(created);
            });
            amenityByCode.put(seed.code(), amenity);
        });

        attach(typeByCode, amenityByCode, "STD", "WIFI", "AC", "TV", "MINIBAR", "KETTLE", "HAIR_DRYER");
        attach(typeByCode, amenityByCode, "SUP", "WIFI", "AC", "TV", "MINIBAR", "KETTLE", "HAIR_DRYER", "DESK", "SAFE");
        attach(typeByCode, amenityByCode, "DLX", "WIFI", "AC", "TV", "MINIBAR", "KETTLE", "HAIR_DRYER", "DESK", "SAFE", "BALCONY", "BATHTUB", "SOFA");
        attach(typeByCode, amenityByCode, "FAM", "WIFI", "AC", "TV", "MINIBAR", "KETTLE", "HAIR_DRYER", "SAFE", "SOFA");
    }

    private void attach(Map<String, RoomType> typeByCode, Map<String, Amenity> amenityByCode,
            String typeCode, String... amenityCodes) {
        List<RoomTypeAmenity> assignments = Arrays.stream(amenityCodes).map(code -> {
            RoomTypeAmenity assignment = new RoomTypeAmenity();
            assignment.setId(new RoomTypeAmenityId(typeByCode.get(typeCode).getId(), amenityByCode.get(code).getId()));
            assignment.setQuantity(1);
            return assignment;
        }).toList();
        roomTypeAmenities.saveAll(assignments);
    }

    private void seedServices() {
        SERVICE_SEEDS.forEach(seed -> services.findByCodeAndDeletedAtIsNull(seed.code()).orElseGet(() -> {
            HotelService service = new HotelService();
            service.setCode(seed.code());
            service.setName(seed.name());
            service.setCategory(seed.category());
            service.setDescription(seed.description());
            service.setUnit(seed.unit());
            service.setUnitPrice(seed.price());
            service.setTaxRate(TAX_RATE);
            service.setCurrency(CURRENCY);
            service.setActive(true);
            return services.save(service);
        }));
    }

    private record FloorSeed(String code, String name, int number, String description) {}

    private record RoomTypeSeed(String code, String name, String description, int adults, int children,
            BigDecimal hourly, BigDecimal daily, BigDecimal nightly) {
        private RoomTypeSeed(String code, String name, String description, int adults, int children,
                String hourly, String daily, String nightly) {
            this(code, name, description, adults, children,
                    new BigDecimal(hourly), new BigDecimal(daily), new BigDecimal(nightly));
        }
    }

    private record AmenitySeed(String code, String name, String description, String icon) {}

    private record ServiceSeed(String code, String name, String category, String unit,
            BigDecimal price, String description) {
        private ServiceSeed(String code, String name, String category, String unit,
                String price, String description) {
            this(code, name, category, unit, new BigDecimal(price), description);
        }
    }
}
