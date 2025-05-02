import os
import pandas as pd
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sklearn.model_selection import train_test_split, TimeSeriesSplit, GridSearchCV
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LinearRegression, Ridge
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.metrics import mean_squared_error
import joblib

load_dotenv()
env = os.environ
engine = create_engine(
    f"postgresql://{env['DB_USERNAME']}:{env['DB_PASSWORD']}@"
    f"{env['DB_HOST']}:{env['DB_PORT']}/{env['DB_NAME']}"
)

# Fetch data from postgres
df = pd.read_sql(
    '''
    SELECT w.user_id,
           e.exercise      AS exercise_name,
           w.start_time    AS date,
           e.sets, e.reps, e.weight
      FROM workouts w
      JOIN exercises e ON w.id = e.workout_id
      ORDER BY w.user_id, e.exercise, w.start_time;
    ''',
    engine
)

# Compute features
df['date'] = pd.to_datetime(df['date'])
df.sort_values(['user_id','exercise_name','date'], inplace=True)


df['total_volume'] = df['weight'] * df['reps'] * df['sets']
df['rolling_vol'] = (
    df.groupby(['user_id','exercise_name'])['total_volume']
      .rolling(3, min_periods=1).mean()
      .reset_index(level=[0,1], drop=True)
)

df['days_since'] = (
    df.groupby(['user_id','exercise_name'])['date']
      .diff().dt.days.fillna(0)
)

df['lag1_w'] = df.groupby(['user_id','exercise_name'])['weight'].shift(1)
df['lag2_w'] = df.groupby(['user_id','exercise_name'])['weight'].shift(2)
df['velocity'] = df['weight'] - df['lag1_w']
df['target'] = df.groupby(['user_id','exercise_name'])['weight'].shift(-1)

# Drop rows missing any core feature/target
df.dropna(subset=[
    'lag1_w','lag2_w','velocity',
    'rolling_vol','days_since','target'
], inplace=True)

# features list
features = [
    'lag1_w','lag2_w','velocity',
    'rolling_vol','days_since',
    'sets','reps','weight'
]

# sanitize name for file
def sanitize(name): return name.lower().replace(' ', '_')

results = {}

for exercise in df['exercise_name'].unique():
    df_ex = df[df['exercise_name'] == exercise]
    X, y = df_ex[features], df_ex['target']

    # time-based hold-out
    X_train, X_hold, y_train, y_hold = train_test_split(
        X, y, test_size=0.2, shuffle=False
    )
    n_train = len(X_train)

    # candidate pipelines
    d = {
        'linreg': (
            Pipeline([('scale', StandardScaler()), ('lr', LinearRegression())]), {}
        ),
        'ridge': (
            Pipeline([('scale', StandardScaler()), ('rg', Ridge())]),
            {'rg__alpha': [0.01,0.1,1,10]}
        ),
        'hgb': (
            Pipeline([('scale', StandardScaler()), ('hgb', HistGradientBoostingRegressor(random_state=42))]),
            {'hgb__max_iter':[50,100], 'hgb__learning_rate':[0.1,0.05], 'hgb__max_depth':[3,5]}
        )
    }
    
    best_hold = float('inf')
    best_model = None
    best_name = None
    best_cv = None

    # dynamic CV
    folds = min(5, max(2, n_train//2))
    tscv = TimeSeriesSplit(n_splits=folds)

    # test each pipeline
    for name,(pipe,grid) in d.items():
        if grid and n_train >= len(grid)+1:
            search = GridSearchCV(pipe, grid, cv=tscv,
                                  scoring='neg_root_mean_squared_error', n_jobs=-1)
            search.fit(X_train, y_train)
            model = search.best_estimator_
            cv_rmse = -search.best_score_
        else:
            pipe.fit(X_train, y_train)
            model = pipe
            cv_rmse = None

        preds = model.predict(X_hold)
        mse = mean_squared_error(y_hold, preds)
        rmse = mse ** 0.5

        if rmse < best_hold:
            best_hold = rmse
            best_model = model
            best_name = name
            best_cv = cv_rmse

    fn = f"{sanitize(exercise)}_{best_name}.pkl"
    joblib.dump(best_model, fn)
    results[exercise] = {'algo':best_name, 'cv_rmse':best_cv, 'hold_rmse':best_hold, 'file':fn}

for ex,st in results.items():
    cv = f"{st['cv_rmse']:.2f}" if st['cv_rmse'] is not None else 'N/A'
    print(f"{ex:15s} | algo={st['algo']:6s} | CV RMSE={cv:>5s} | Hold-out RMSE={st['hold_rmse']:.2f} lbs | file={st['file']}")