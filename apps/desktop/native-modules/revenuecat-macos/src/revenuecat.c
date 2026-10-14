#include <node_api.h>
#include <stdlib.h>
#include <string.h>

extern void onekey_revenuecat_invoke(const char *, void *, void (*)(void *, const char *));

typedef struct {
    napi_deferred deferred;
    napi_threadsafe_function completion;
} RevenueCatRequest;

static void finalize_request(napi_env env, void *data, void *hint) {
    (void)env;
    (void)hint;
    free(data);
}

static void resolve_request(napi_env env, napi_value callback, void *context, void *data) {
    (void)callback;
    RevenueCatRequest *request = context;
    char *response = data;
    if (env != NULL) {
        napi_value value;
        const char *json = response != NULL ? response :
            "{\"error\":{\"code\":\"BRIDGE_ERROR\",\"message\":\"RevenueCat response allocation failed\"}}";
        if (napi_create_string_utf8(env, json, NAPI_AUTO_LENGTH, &value) == napi_ok) {
            napi_resolve_deferred(env, request->deferred, value);
        }
    }
    free(response);
}

static void complete_request(void *context, const char *json) {
    RevenueCatRequest *request = context;
    char *response = strdup(json);
    if (napi_call_threadsafe_function(request->completion, response, napi_tsfn_nonblocking) != napi_ok) {
        free(response);
    }
    napi_release_threadsafe_function(request->completion, napi_tsfn_release);
}

static napi_value invoke(napi_env env, napi_callback_info info) {
    size_t argc = 1;
    napi_value argv[1];
    size_t length;
    if (napi_get_cb_info(env, info, &argc, argv, NULL, NULL) != napi_ok || argc != 1 ||
        napi_get_value_string_utf8(env, argv[0], NULL, 0, &length) != napi_ok) {
        napi_throw_type_error(env, NULL, "Expected a RevenueCat JSON request");
        return NULL;
    }
    char *json = malloc(length + 1);
    RevenueCatRequest *request = calloc(1, sizeof(RevenueCatRequest));
    if (json == NULL || request == NULL) {
        free(json);
        free(request);
        napi_throw_error(env, NULL, "RevenueCat request allocation failed");
        return NULL;
    }
    napi_value promise;
    napi_value name;
    if (napi_get_value_string_utf8(env, argv[0], json, length + 1, &length) != napi_ok ||
        napi_create_promise(env, &request->deferred, &promise) != napi_ok ||
        napi_create_string_utf8(env, "RevenueCat", NAPI_AUTO_LENGTH, &name) != napi_ok ||
        napi_create_threadsafe_function(env, NULL, NULL, name, 0, 1, request, finalize_request,
                                       request, resolve_request, &request->completion) != napi_ok) {
        free(json);
        free(request);
        napi_throw_error(env, NULL, "Could not create RevenueCat request");
        return NULL;
    }
    // No worker thread waits for a purchase. The SDK completes through Node's thread-safe queue.
    onekey_revenuecat_invoke(json, request, complete_request);
    free(json);
    return promise;
}

static napi_value initialize(napi_env env, napi_value exports) {
    napi_property_descriptor methods[] = {
        { "invoke", NULL, invoke, NULL, NULL, NULL, napi_default, NULL }
    };
    napi_define_properties(env, exports, 1, methods);
    return exports;
}

NAPI_MODULE(revenuecat, initialize)
