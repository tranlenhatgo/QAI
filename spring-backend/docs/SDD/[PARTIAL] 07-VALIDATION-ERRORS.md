# 07 — Validation & Error Handling

## Validation Architecture

### DTO Annotations

DTOs use Jakarta Validation annotations:
```java
@NotBlank(message = "Title cannot be blank")
private String title;

@Size(max = 1, message = "A quiz must have at most one category")
private List<String> categories;

@JsonDeserialize(using = TimestampDeserializer.class)
private Timestamp startTime;
```

### Validation Flow

```
Controller method(@Valid dto, BindingResult result)
  → RestVerifier.verifyModelResult(result)
  → if errors: throw ModelVerificationException(firstFieldError)
  → else: proceed to service layer
```

---

## Exception Hierarchy

```
RuntimeException
└── QuizException (abstract, serialVersionUID = 1L)
    └── ModelVerificationException
        - message: first field validation error
        - thrown by: RestVerifier.verifyModelResult()
```

---

## Error Response Format

All errors return:
```json
{
  "message": "Title cannot be blank",
  "statusCode": 400
}
```

> Note: No centralized `@ControllerAdvice` / `@ExceptionHandler` is registered.
> Spring Boot's default error handling converts exceptions to the response shape.

---

## RestVerifier Utility

Located in `utils/RestVerifier.java`:
- Takes `BindingResult` from controller
- Checks `hasErrors()`
- Extracts first field error message
- Throws `ModelVerificationException` with that message

---

## Custom Deserializers

### TimestampDeserializer
- Converts ISO-8601 strings from JSON to Google Firestore `Timestamp` objects
- Registered via `@JsonDeserialize` on DTO timestamp fields
- Handles `null` values gracefully

---

## Lombok Effects on Validation

| Annotation | Effect |
|-----------|--------|
| `@NonNull` | Generates null-check in constructor/setter (throws NPE) |
| `@SneakyThrows` | Wraps checked exceptions as unchecked (no try/catch needed) |
| `@Builder` | Generates builder pattern for entity construction |
| `@Data` | Generates getters, setters, equals, hashCode, toString |
