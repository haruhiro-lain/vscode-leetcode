import java.io.*;
import java.lang.reflect.*;
import java.math.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

public class LocalJavaRunner {
    static Object read(DataInputStream in) throws IOException {
        int tag = in.readUnsignedByte();
        switch (tag) {
            case 0: return null;
            case 1: return in.readBoolean();
            case 2: return new BigDecimal(text(in));
            case 3: return text(in);
            case 4: {
                int count = in.readInt();
                List<Object> result = new ArrayList<>();
                for (int i = 0; i < count; i++) result.add(read(in));
                return result;
            }
            case 5: {
                int count = in.readInt();
                Map<String, Object> result = new LinkedHashMap<>();
                for (int i = 0; i < count; i++) result.put(text(in), read(in));
                return result;
            }
            default: throw new IOException("Invalid test data tag " + tag);
        }
    }
    static String text(DataInputStream in) throws IOException {
        byte[] bytes = new byte[in.readInt()];
        in.readFully(bytes);
        return new String(bytes, StandardCharsets.UTF_8);
    }
    static Object convert(Object value, Type generic) throws Exception {
        Class<?> type = generic instanceof ParameterizedType ? (Class<?>) ((ParameterizedType) generic).getRawType() : (Class<?>) generic;
        if (value == null) {
            if (type.isPrimitive()) throw new IllegalArgumentException("null cannot be used for " + type.getName());
            return null;
        }
        if (type == Object.class) return value;
        if (type == String.class) {
            if (!(value instanceof String)) throw new IllegalArgumentException("Expected a string");
            return value;
        }
        if (type == boolean.class || type == Boolean.class) {
            if (!(value instanceof Boolean)) throw new IllegalArgumentException("Expected a boolean");
            return value;
        }
        if (type == char.class || type == Character.class) {
            if (!(value instanceof String) || ((String) value).length() != 1) throw new IllegalArgumentException("char requires one character");
            return ((String) value).charAt(0);
        }
        if (value instanceof BigDecimal) {
            BigDecimal number = (BigDecimal) value;
            if (type == int.class || type == Integer.class) return number.intValueExact();
            if (type == long.class || type == Long.class) return number.longValueExact();
            if (type == short.class || type == Short.class) return number.shortValueExact();
            if (type == byte.class || type == Byte.class) return number.byteValueExact();
            if (type == double.class || type == Double.class) return number.doubleValue();
            if (type == float.class || type == Float.class) return number.floatValue();
        }
        if (type.isArray() && value instanceof List) {
            List<?> list = (List<?>) value;
            Object array = Array.newInstance(type.getComponentType(), list.size());
            for (int i = 0; i < list.size(); i++) Array.set(array, i, convert(list.get(i), type.getComponentType()));
            return array;
        }
        if (Collection.class.isAssignableFrom(type) && value instanceof List) {
            Type element = generic instanceof ParameterizedType ? ((ParameterizedType) generic).getActualTypeArguments()[0] : Object.class;
            Collection<Object> result = Set.class.isAssignableFrom(type) ? new LinkedHashSet<>() : new ArrayList<>();
            for (Object item : (List<?>) value) result.add(convert(item, element));
            return result;
        }
        throw new IllegalArgumentException("Unsupported argument type: " + generic + "; supports primitives, strings, arrays and List/Set");
    }
    static String quote(String text) {
        StringBuilder result = new StringBuilder("\"");
        for (char c : text.toCharArray()) {
            switch (c) {
                case '"': result.append("\\\""); break;
                case '\\': result.append("\\\\"); break;
                case '\n': result.append("\\n"); break;
                case '\r': result.append("\\r"); break;
                case '\t': result.append("\\t"); break;
                default: if (c < 32) result.append(String.format("\\u%04x", (int) c)); else result.append(c);
            }
        }
        return result.append('"').toString();
    }
    static String json(Object value) {
        if (value == null) return "null";
        if (value instanceof String || value instanceof Character) return quote(value.toString());
        if (value instanceof Number) return new BigDecimal(value.toString()).stripTrailingZeros().toPlainString();
        if (value instanceof Boolean) return value.toString();
        List<String> items = new ArrayList<>();
        if (value.getClass().isArray()) {
            for (int i = 0; i < Array.getLength(value); i++) items.add(json(Array.get(value, i)));
        } else if (value instanceof Collection) {
            for (Object item : (Collection<?>) value) items.add(json(item));
        } else throw new IllegalArgumentException("Unsupported result type: " + value.getClass().getName());
        return "[" + String.join(",", items) + "]";
    }
    static List<Object> list(Object value) {
        List<Object> result = new ArrayList<>();
        if (value != null && value.getClass().isArray()) {
            for (int i = 0; i < Array.getLength(value); i++) result.add(Array.get(value, i));
        } else if (value instanceof Collection) result.addAll((Collection<?>) value);
        else throw new IllegalArgumentException("unordered comparison requires array/list output");
        return result;
    }
    static String canonical(Object value, String comparison) {
        if (comparison.equals("exact")) return json(value);
        List<String> result = new ArrayList<>();
        for (Object item : list(value)) result.add(comparison.equals("unorderedNested") ? canonical(item, "unordered") : json(item));
        Collections.sort(result);
        return "[" + String.join(",", result) + "]";
    }
    static String preview(Object value) {
        String text = json(value);
        return text.length() > 1200 ? text.substring(0, 1200) + "… (" + text.length() + " chars)" : text;
    }
    @SuppressWarnings("unchecked")
    public static void main(String[] args) throws Exception {
        int index = Integer.parseInt(args[1]);
        Map<String, Object> data;
        try (DataInputStream in = new DataInputStream(new BufferedInputStream(new FileInputStream(args[0])))) {
            data = (Map<String, Object>) read(in);
        }
        Map<String, Object> item = (Map<String, Object>) ((List<?>) data.get("cases")).get(index);
        System.out.println("\n用例 " + (index + 1));
        System.out.println("输入：" + preview(item.get("input")));
        System.out.println("期望：" + preview(item.get("expected")));
        try {
            List<?> inputs = (List<?>) item.get("input");
            String name = (String) data.get("method");
            List<Method> methods = new ArrayList<>();
            for (Method method : Solution.class.getDeclaredMethods()) {
                if (!method.isSynthetic() && method.getParameterTypes().length == inputs.size()
                        && (name == null ? Modifier.isPublic(method.getModifiers()) : name.equals(method.getName()))) methods.add(method);
            }
            if (methods.size() != 1) throw new IllegalArgumentException("Cannot identify method; set method in the test file (matched " + methods.size() + ")");
            Method method = methods.get(0);
            method.setAccessible(true);
            Object[] parameters = new Object[inputs.size()];
            Type[] types = method.getGenericParameterTypes();
            for (int i = 0; i < parameters.length; i++) parameters[i] = convert(inputs.get(i), types[i]);
            Constructor<?> constructor = Solution.class.getDeclaredConstructor();
            constructor.setAccessible(true);
            Object solution = constructor.newInstance();
            long start = System.nanoTime();
            Object actual = method.invoke(solution, parameters);
            if (method.getReturnType() == void.class) {
                int outputArg = item.containsKey("outputArg") ? ((BigDecimal) item.get("outputArg")).intValueExact() : 0;
                if (outputArg >= parameters.length) throw new IllegalArgumentException("void method requires outputArg");
                actual = parameters[outputArg];
            }
            long elapsed = (System.nanoTime() - start) / 1000000;
            String comparison = item.containsKey("comparison") ? (String) item.get("comparison") : "exact";
            boolean pass = canonical(actual, comparison).equals(canonical(item.get("expected"), comparison));
            System.out.println("实际：" + preview(actual));
            System.out.println((pass ? "PASS" : "FAIL") + " (" + elapsed + " ms)");
            if (!pass) System.exit(1);
        } catch (Throwable error) {
            if (error instanceof InvocationTargetException) error = ((InvocationTargetException) error).getTargetException();
            System.out.println("FAIL：" + error);
            System.exit(1);
        }
    }
}
