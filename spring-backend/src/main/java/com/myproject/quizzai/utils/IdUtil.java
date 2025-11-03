package com.myproject.quizzai.utils;

import java.util.UUID;

public class IdUtil {
    public static String generateId(){
        return UUID.randomUUID().toString().substring(0, 8);
    }
}
